import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const ownerA = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const ownerB = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const apiaryA = "aaaaaaaa-0000-4000-a000-000000000001";
const apiaryB = "bbbbbbbb-0000-4000-b000-000000000001";
const hiveA = "aaaaaaaa-0000-4000-a000-000000000002";
const hiveB = "bbbbbbbb-0000-4000-b000-000000000002";
let db: PGlite;
async function asUser(owner: string) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    owner,
  ]);
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  db = await PGlite.create();
  // Supabase service scaffolding only. Application tables, RLS and queue use the real migrations.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to anon,authenticated,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
    grant usage on schema storage to authenticated;
    grant select,insert,update on storage.objects to authenticated;
    alter table storage.objects enable row level security;
  `);
  for (const migration of [
    "202610200001_core.sql",
    "202610210001_summary_queue.sql",
  ]) {
    await db.exec(
      await readFile(
        new URL(`../migrations/${migration}`, import.meta.url),
        "utf8",
      ),
    );
  }
  await db.query("insert into auth.users values ($1),($2)", [ownerA, ownerB]);
  await db.query(
    "insert into public.apiaries(id,user_id,name) values ($1,$2,'A'),($3,$4,'B')",
    [apiaryA, ownerA, apiaryB, ownerB],
  );
  await db.query(
    "insert into public.hives(id,apiary_id,code) values ($1,$2,'A'),($3,$4,'B')",
    [hiveA, apiaryA, hiveB, apiaryB],
  );
  await db.query(
    "insert into storage.objects(bucket_id,name) values ('hive-audio',$1),('hive-audio',$2)",
    [`${ownerA}/${hiveA}/a.wav`, `${ownerB}/${hiveB}/b.wav`],
  );
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback; reset role");
});
afterAll(async () => {
  await db?.close();
});

describe("Postgres RLS from migrations", () => {
  it("isolates apiaries and hives between users", async () => {
    await asUser(ownerB);
    expect((await db.query("select name from public.apiaries")).rows).toEqual([
      { name: "B" },
    ]);
    expect((await db.query("select code from public.hives")).rows).toEqual([
      { code: "B" },
    ]);
    await db.query("update public.apiaries set name='forbidden' where id=$1", [
      apiaryA,
    ]);
    await db.exec("reset role");
    expect(
      (
        await db.query("select name from public.apiaries where id=$1", [
          apiaryA,
        ])
      ).rows,
    ).toEqual([{ name: "A" }]);
  });
  it("rejects a hive inserted under someone else's apiary", async () => {
    await asUser(ownerB);
    await expect(
      db.query(
        "insert into public.hives(id,apiary_id,code) values (gen_random_uuid(),$1,'forbidden')",
        [apiaryA],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("protects audio metadata paths for reads and writes", async () => {
    await asUser(ownerB);
    expect((await db.query("select name from storage.objects")).rows).toEqual([
      { name: `${ownerB}/${hiveB}/b.wav` },
    ]);
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values ('hive-audio',$1)",
        [`${ownerB}/${hiveA}/forbidden.wav`],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("prevents client roles from claiming privileged jobs", async () => {
    await asUser(ownerA);
    await expect(
      db.query("select * from public.claim_hive_summary_jobs(10)"),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
describe("Postgres cron queue", () => {
  it("drains more than 500 hives through bounded leases without omitting any", async () => {
    await db.query(
      "insert into public.hives(id,apiary_id,code) select gen_random_uuid(),$1,'scale-'||i from generate_series(1,501) i",
      [apiaryA],
    );
    const seen = new Set<string>();
    for (;;) {
      const { rows } = await db.query<{ hive_id: string; lease_token: string }>(
        "select * from public.claim_hive_summary_jobs(25)",
      );
      if (!rows.length) break;
      expect(rows.length).toBeLessThanOrEqual(25);
      for (const row of rows) {
        expect(seen.has(row.hive_id)).toBe(false);
        seen.add(row.hive_id);
        await db.query("select public.finish_hive_summary_job($1,$2,true)", [
          row.hive_id,
          row.lease_token,
        ]);
      }
    }
    expect(seen.size).toBe(503);
  });
  it("keeps failed windows stable, rejects obsolete tokens and recovers an expired lease", async () => {
    const first = (
      await db.query<{
        hive_id: string;
        lease_token: string;
        window_end: Date;
      }>("select * from public.claim_hive_summary_jobs(1)")
    ).rows[0];
    expect(
      (
        await db.query(
          "select public.finish_hive_summary_job($1,gen_random_uuid(),true) as ok",
          [first.hive_id],
        )
      ).rows,
    ).toEqual([{ ok: false }]);
    await db.query("select public.finish_hive_summary_job($1,$2,false)", [
      first.hive_id,
      first.lease_token,
    ]);
    const retry = (
      await db.query<{ attempts: number; later: boolean }>(
        "select attempts,available_at>now() as later from apisense_private.hive_summary_jobs where hive_id=$1",
        [first.hive_id],
      )
    ).rows[0];
    expect(retry).toEqual({ attempts: 1, later: true });
    await db.exec(
      "update apisense_private.hive_summary_jobs set available_at=now()+interval '1 day'",
    );
    await db.query(
      "update apisense_private.hive_summary_jobs set available_at=now()-interval '1 minute' where hive_id=$1",
      [first.hive_id],
    );
    const second = (
      await db.query<{
        hive_id: string;
        lease_token: string;
        window_end: Date;
      }>("select * from public.claim_hive_summary_jobs(1)")
    ).rows[0];
    expect(second.window_end).toEqual(first.window_end);
    await db.query(
      "update apisense_private.hive_summary_jobs set lease_until=now()-interval '1 second' where hive_id=$1",
      [first.hive_id],
    );
    const third = (
      await db.query<{ lease_token: string; window_end: Date }>(
        "select * from public.claim_hive_summary_jobs(1)",
      )
    ).rows[0];
    expect(third.lease_token).not.toBe(second.lease_token);
    expect(third.window_end).toEqual(first.window_end);
    expect(
      (
        await db.query(
          "select public.finish_hive_summary_job($1,$2,true) as ok",
          [first.hive_id, second.lease_token],
        )
      ).rows,
    ).toEqual([{ ok: false }]);
  });
  it("rejects an unbounded or invalid batch size", async () => {
    for (const size of [null, 0, 26]) {
      await db.exec("savepoint invalid_size");
      await expect(
        db.query("select * from public.claim_hive_summary_jobs($1)", [size]),
      ).rejects.toMatchObject({ message: "Invalid batch size" });
      await db.exec("rollback to savepoint invalid_size");
    }
  });
});

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
    "202611020001_brood_cycles.sql",
    "202611090001_apiary_profile_observations.sql",
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
  it("isolates brood cycles and rejects cross-hive writes", async () => {
    const cycleA = "aaaaaaaa-0000-4000-a000-000000000101";
    const cycleB = "bbbbbbbb-0000-4000-b000-000000000101";
    await db.query(
      "insert into public.brood_cycles(id,hive_id,cohort_label,started_on,state,observed_stage) values ($1,$2,'Cuadro A','2026-10-20','active','unknown'),($3,$4,'Cuadro B','2026-10-21','active','unknown')",
      [cycleA, hiveA, cycleB, hiveB],
    );
    await asUser(ownerB);
    expect(
      (await db.query("select cohort_label from public.brood_cycles")).rows,
    ).toEqual([{ cohort_label: "Cuadro B" }]);
    await db.query(
      "update public.brood_cycles set cohort_label='forbidden' where id=$1",
      [cycleA],
    );
    await expect(
      db.query(
        "insert into public.brood_cycles(id,hive_id,cohort_label,started_on,state,observed_stage) values(gen_random_uuid(),$1,'bad','2026-10-20','active','unknown')",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("rejects inconsistent brood completion", async () => {
    await asUser(ownerA);
    await expect(
      db.query(
        "insert into public.brood_cycles(id,hive_id,cohort_label,started_on,state,observed_stage) values(gen_random_uuid(),$1,'Cuadro','2026-10-20','emerged','unknown')",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("persists manual emergence with ownership policy and server timestamp", async () => {
    await asUser(ownerA);
    const rows = await db.query(
      "insert into public.brood_cycles(id,hive_id,cohort_label,started_on,state,observed_stage,observed_at,ended_at) values(gen_random_uuid(),$1,'Cuadro','2026-10-20','emerged','emerged',now(),now()) returning state,observed_stage,updated_at",
      [hiveA],
    );
    expect(rows.rows[0]).toMatchObject({
      state: "emerged",
      observed_stage: "emerged",
    });
    expect(rows.rows[0]).toHaveProperty("updated_at");
  });
  it("rejects an unknown stores level", async () => {
    await asUser(ownerA);
    await expect(
      db.query(
        "insert into public.inspections(id,hive_id,inspected_at,notes,tags_json,queen_seen,stores) values(gen_random_uuid(),$1,now(),'nota','[]',0,'huge')",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("rejects an oversized season calendar and a preset without data", async () => {
    await asUser(ownerA);
    await expect(
      db.query("update public.apiaries set seasons_json=$2 where id=$1", [
        apiaryA,
        "x".repeat(8193),
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("rejects a region preset that has no documented calendar", async () => {
    await asUser(ownerA);
    await expect(
      db.query(
        "update public.apiaries set region_preset='tropical' where id=$1",
        [apiaryA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("rejects an unknown check-in frequency", async () => {
    await asUser(ownerA);
    await expect(
      db.query(
        "update public.apiaries set checkin_frequency='hourly' where id=$1",
        [apiaryA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("rejects an unknown eggs state", async () => {
    await asUser(ownerA);
    await expect(
      db.query(
        "insert into public.inspections(id,hive_id,inspected_at,notes,tags_json,queen_seen,eggs_state) values(gen_random_uuid(),$1,now(),'nota','[]',0,'many')",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("rejects an invalid weather flag", async () => {
    await asUser(ownerA);
    await expect(
      db.query("update public.apiaries set weather_enabled=2 where id=$1", [
        apiaryA,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("keeps 0.2.0 columns additive: defaults for writers that omit them", async () => {
    await asUser(ownerA);
    const note = await db.query(
      "insert into public.inspections(id,hive_id,inspected_at,notes,tags_json,queen_seen) values(gen_random_uuid(),$1,now(),'nota','[]',0) returning queen_state,eggs_state,queen_cells,activity,population,stores",
      [hiveA],
    );
    expect(note.rows[0]).toEqual({
      queen_state: null,
      eggs_state: null,
      queen_cells: null,
      activity: null,
      population: null,
      stores: null,
    });
    const apiary = await db.query(
      "select region_preset,seasons_json,weather_enabled,checkin_frequency from public.apiaries where id=$1",
      [apiaryA],
    );
    expect(apiary.rows[0]).toEqual({
      region_preset: null,
      seasons_json: null,
      weather_enabled: 0,
      checkin_frequency: "weekly",
    });
  });
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

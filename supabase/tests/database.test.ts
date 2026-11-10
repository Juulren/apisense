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
    create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
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
    "202611100001_edge_verdicts.sql",
    "202611110001_profiles.sql",
    "202611110002_delete_account_data.sql",
  ]) {
    await db.exec(
      await readFile(
        new URL(`../migrations/${migration}`, import.meta.url),
        "utf8",
      ),
    );
  }
  await db.query("insert into auth.users(id) values ($1),($2)", [ownerA, ownerB]);
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
  it("isolates node verdicts between users and rejects cross-hive writes", async () => {
    await db.query(
      "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence) values (gen_random_uuid(),$1,now(),'lora',1,1,1,0.8),(gen_random_uuid(),$2,now(),'lora',1,1,0,0.9)",
      [hiveA, hiveB],
    );
    await asUser(ownerB);
    expect(
      (await db.query("select class_code from public.edge_verdicts")).rows,
    ).toEqual([{ class_code: 0 }]);
    await expect(
      db.query(
        "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence) values(gen_random_uuid(),$1,now(),'lora',1,1,1,0.8)",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("lets the owner review a verdict only with a review time", async () => {
    await db.query(
      "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence) values ('aaaaaaaa-0000-4000-a000-0000000000e1',$1,now(),'lora',1,1,1,0.8)",
      [hiveA],
    );
    await asUser(ownerA);
    const done = await db.query(
      "update public.edge_verdicts set review='false_alarm', reviewed_at=now() where id='aaaaaaaa-0000-4000-a000-0000000000e1' returning review",
    );
    expect(done.rows).toEqual([{ review: "false_alarm" }]);
  });
  it("rejects a review without its time", async () => {
    await db.query(
      "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence) values ('aaaaaaaa-0000-4000-a000-0000000000e2',$1,now(),'lora',1,1,1,0.8)",
      [hiveA],
    );
    await asUser(ownerA);
    await expect(
      db.query(
        "update public.edge_verdicts set review='seen' where id='aaaaaaaa-0000-4000-a000-0000000000e2'",
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("makes a retried uplink idempotent through the dedupe key", async () => {
    await db.query(
      "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence,dedupe_key) values (gen_random_uuid(),$1,now(),'lora',1,1,1,0.8,'0123456789abcdef:42:')",
      [hiveA],
    );
    await expect(
      db.query(
        "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence,dedupe_key) values (gen_random_uuid(),$1,now(),'lora',1,1,1,0.8,'0123456789abcdef:42:')",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
  it("rejects an impossible confidence", async () => {
    await expect(
      db.query(
        "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence) values (gen_random_uuid(),$1,now(),'lora',1,1,1,1.5)",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("rejects an unknown source", async () => {
    await expect(
      db.query(
        "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence) values (gen_random_uuid(),$1,now(),'radio',1,1,1,0.5)",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("rejects a malformed DevEUI", async () => {
    await expect(
      db.query(
        "insert into public.iot_microphones(id,hive_id,mac_address,firmware_version,battery_level,sampling_rate_hz,is_online,dev_eui) values (gen_random_uuid(),$1,'AA','v1',90,16000,0,'ZZZ')",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("links a DevEUI to one node only", async () => {
    await db.query(
      "insert into public.iot_microphones(id,hive_id,mac_address,firmware_version,battery_level,sampling_rate_hz,is_online,dev_eui) values (gen_random_uuid(),$1,'AA','v1',90,16000,0,'70b3d57ed0000001')",
      [hiveA],
    );
    await expect(
      db.query(
        "insert into public.iot_microphones(id,hive_id,mac_address,firmware_version,battery_level,sampling_rate_hz,is_online,dev_eui) values (gen_random_uuid(),$1,'BB','v1',90,16000,0,'70b3d57ed0000001')",
        [hiveB],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
  it("does not let an owner forge a LoRaWAN verdict", async () => {
    await asUser(ownerA);
    await expect(
      db.query(
        "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence) values (gen_random_uuid(),$1,now(),'lora',1,1,1,0.8)",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("does not let an owner squat a dedupe key", async () => {
    await asUser(ownerA);
    await expect(
      db.query(
        "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence,dedupe_key) values (gen_random_uuid(),$1,now(),'ble',1,1,1,0.8,'70b3d57ed0000099:1:')",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("lets an owner add a verdict from the app's own transports", async () => {
    await asUser(ownerA);
    const rows = await db.query(
      "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence) values (gen_random_uuid(),$1,now(),'ble',1,1,1,0.8) returning source",
      [hiveA],
    );
    expect(rows.rows).toEqual([{ source: "ble" }]);
  });
  it("does not let an owner rewrite what the node reported", async () => {
    await db.query(
      "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence) values ('aaaaaaaa-0000-4000-a000-0000000000e3',$1,now(),'lora',1,1,1,0.8)",
      [hiveA],
    );
    await asUser(ownerA);
    await expect(
      db.query(
        "update public.edge_verdicts set class_code=0 where id='aaaaaaaa-0000-4000-a000-0000000000e3'",
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("lets the owner review with a full-row update whose other fields are unchanged", async () => {
    await db.query(
      "insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence,temperature_c) values ('aaaaaaaa-0000-4000-a000-0000000000e4',$1,now(),'lora',1,1,1,0.8,27.5)",
      [hiveA],
    );
    await asUser(ownerA);
    const done = await db.query(
      "update public.edge_verdicts set class_code=class_code, confidence=confidence, temperature_c=temperature_c, source=source, review='confirmed', reviewed_at=now(), review_note='Revisada' where id='aaaaaaaa-0000-4000-a000-0000000000e4' returning review",
    );
    expect(done.rows).toEqual([{ review: "confirmed" }]);
  });
  const claimHash = "encode(sha256(convert_to('codigo-secreto-1','UTF8')),'hex')";
  async function registerNode(eui = "70b3d57ed0000010") {
    await db.query(
      `insert into public.lora_nodes(dev_eui,claim_hash) values ($1,${claimHash})`,
      [eui],
    );
  }
  it("claims a node only with the right code, and only for one account", async () => {
    await registerNode();
    await asUser(ownerA);
    const wrong = await db.query(
      "select public.claim_lora_node('70b3d57ed0000010','codigo-incorrecto') as ok",
    );
    expect(wrong.rows).toEqual([{ ok: false }]);
    const right = await db.query(
      "select public.claim_lora_node('70b3d57ed0000010','codigo-secreto-1') as ok",
    );
    expect(right.rows).toEqual([{ ok: true }]);
    await asUser(ownerB);
    const other = await db.query(
      "select public.claim_lora_node('70b3d57ed0000010','codigo-secreto-1') as ok",
    );
    expect(other.rows).toEqual([{ ok: false }]);
  });
  it("answers false for unknown nodes, malformed input and short codes", async () => {
    await registerNode();
    await asUser(ownerA);
    const answers = [
      "select public.claim_lora_node('70b3d57ed00000ff','codigo-secreto-1') as ok",
      "select public.claim_lora_node('ZZ','codigo-secreto-1') as ok",
      "select public.claim_lora_node('70b3d57ed0000010','corto') as ok",
      "select public.claim_lora_node(null,null) as ok",
    ];
    for (const sql of answers)
      expect((await db.query(sql)).rows).toEqual([{ ok: false }]);
  });
  it("locks a node after ten wrong codes, even for the right one", async () => {
    await registerNode();
    await asUser(ownerA);
    for (let i = 0; i < 10; i++)
      await db.query(
        "select public.claim_lora_node('70b3d57ed0000010','codigo-incorrecto') as ok",
      );
    const locked = await db.query(
      "select public.claim_lora_node('70b3d57ed0000010','codigo-secreto-1') as ok",
    );
    expect(locked.rows).toEqual([{ ok: false }]);
  });
  it("keeps the claim table out of reach of users", async () => {
    await registerNode();
    await asUser(ownerA);
    await expect(db.query("select * from public.lora_nodes")).rejects.toMatchObject({
      code: "42501",
    });
  });
  it("links a DevEUI to a microphone only after claiming it", async () => {
    await registerNode();
    await asUser(ownerA);
    await expect(
      db.query(
        "insert into public.iot_microphones(id,hive_id,mac_address,firmware_version,battery_level,sampling_rate_hz,is_online,dev_eui) values (gen_random_uuid(),$1,'AA','v1',90,16000,0,'70b3d57ed0000010')",
        [hiveA],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("lets the claimant link it and refuses anybody else", async () => {
    await registerNode();
    await asUser(ownerA);
    await db.query(
      "select public.claim_lora_node('70b3d57ed0000010','codigo-secreto-1')",
    );
    const linked = await db.query(
      "insert into public.iot_microphones(id,hive_id,mac_address,firmware_version,battery_level,sampling_rate_hz,is_online,dev_eui) values (gen_random_uuid(),$1,'AA','v1',90,16000,0,'70b3d57ed0000010') returning dev_eui",
      [hiveA],
    );
    expect(linked.rows).toEqual([{ dev_eui: "70b3d57ed0000010" }]);
    await asUser(ownerB);
    await expect(
      db.query(
        "insert into public.iot_microphones(id,hive_id,mac_address,firmware_version,battery_level,sampling_rate_hz,is_online,dev_eui) values (gen_random_uuid(),$1,'BB','v1',90,16000,0,'70b3d57ed0000010')",
        [hiveB],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("still lets a microphone exist without a DevEUI (Bluetooth nodes)", async () => {
    await asUser(ownerA);
    const rows = await db.query(
      "insert into public.iot_microphones(id,hive_id,mac_address,firmware_version,battery_level,sampling_rate_hz,is_online) values (gen_random_uuid(),$1,'AA','v1',90,16000,0) returning dev_eui",
      [hiveA],
    );
    expect(rows.rows).toEqual([{ dev_eui: null }]);
  });
  it("prunes only old, unreviewed usual-sound verdicts, and only on the server side", async () => {
    await db.query(
      `insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence,review,reviewed_at) values
         (gen_random_uuid(),$1,now()-interval '40 days','lora',1,1,0,0.9,null,null),
         (gen_random_uuid(),$1,now()-interval '1 day','lora',1,1,0,0.9,null,null),
         (gen_random_uuid(),$1,now()-interval '40 days','lora',1,1,1,0.8,null,null),
         (gen_random_uuid(),$1,now()-interval '40 days','lora',1,1,0,0.9,'seen',now())`,
      [hiveA],
    );
    await db.query("select public.prune_edge_verdicts()");
    const left = await db.query(
      "select class_code, review from public.edge_verdicts order by class_code, review nulls first",
    );
    expect(left.rows).toHaveLength(3);
    await asUser(ownerA);
    await expect(db.query("select public.prune_edge_verdicts()")).rejects.toMatchObject({
      code: "42501",
    });
  });
  it("creates a profile at sign-up, taking the name from the metadata", async () => {
    await db.query(
      "insert into auth.users(id,raw_user_meta_data) values ('cccccccc-cccc-4ccc-cccc-cccccccccccc','{\"display_name\":\"  Damaris  \"}')",
    );
    const rows = await db.query(
      "select display_name from public.profiles where id='cccccccc-cccc-4ccc-cccc-cccccccccccc'",
    );
    expect(rows.rows).toEqual([{ display_name: "Damaris" }]);
  });
  it("never blocks sign-up because of a bad or missing name", async () => {
    const bad = [
      "'{\"display_name\":\"" + "x".repeat(51) + "\"}'",
      "'{\"display_name\":\"a\\u0007b\"}'",
      "null",
    ];
    for (const [i, meta] of bad.entries()) {
      const id = `dddddddd-dddd-4ddd-dddd-ddddddddddd${i}`;
      await db.query(
        `insert into auth.users(id,raw_user_meta_data) values ('${id}',${meta})`,
      );
      const rows = await db.query(
        "select display_name from public.profiles where id=$1",
        [id],
      );
      expect(rows.rows).toEqual([{ display_name: null }]);
    }
  });
  it("lets users read and rename only their own profile", async () => {
    await asUser(ownerA);
    const mine = await db.query("select id from public.profiles");
    expect(mine.rows).toEqual([{ id: ownerA }]);
    await db.query("update public.profiles set display_name='Ana' where id=$1", [ownerA]);
    const other = await db.query(
      "update public.profiles set display_name='Hackeado' where id=$1 returning id",
      [ownerB],
    );
    expect(other.rows).toEqual([]);
    const seen = await db.query("select display_name from public.profiles");
    expect(seen.rows).toEqual([{ display_name: "Ana" }]);
  });
  it("refuses an empty name", async () => {
    await asUser(ownerA);
    await expect(
      db.query("update public.profiles set display_name='' where id=$1", [ownerA]),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("refuses a name with surrounding spaces", async () => {
    await asUser(ownerA);
    await expect(
      db.query("update public.profiles set display_name=' Ana' where id=$1", [ownerA]),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("refuses changing any column other than the name", async () => {
    await asUser(ownerA);
    await expect(
      db.query("update public.profiles set id=$2 where id=$1", [ownerA, ownerB]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("gives clients no way to create profiles", async () => {
    await asUser(ownerA);
    await expect(
      db.query("insert into public.profiles(id) values (gen_random_uuid())"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("gives clients no way to delete profiles", async () => {
    await asUser(ownerA);
    await expect(
      db.query("delete from public.profiles where id=$1", [ownerA]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("removes the profile together with the account", async () => {
    await db.query("delete from auth.users where id='cccccccc-cccc-4ccc-cccc-cccccccccccc'");
    await db.query("insert into auth.users(id) values ('cccccccc-cccc-4ccc-cccc-cccccccccccc')");
    await db.query("delete from auth.users where id='cccccccc-cccc-4ccc-cccc-cccccccccccc'");
    const rows = await db.query(
      "select 1 from public.profiles where id='cccccccc-cccc-4ccc-cccc-cccccccccccc'",
    );
    expect(rows.rows).toEqual([]);
  });
  it("does not let a signed-in user call the account wipe", async () => {
    await asUser(ownerA);
    await expect(
      db.query("select public.delete_account_data($1)", [ownerB]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("wipes everything one account owns, child rows first, and nothing else", async () => {
    await db.query(
      `insert into public.iot_microphones(id,hive_id,mac_address,firmware_version,battery_level,sampling_rate_hz,is_online)
         values ('aaaaaaaa-0000-4000-a000-0000000000f1',$1,'AA','v1',90,16000,0)`,
      [hiveA],
    );
    await db.query(
      `insert into public.edge_verdicts(id,hive_id,recorded_at,source,format_version,class_map_version,class_code,confidence)
         values (gen_random_uuid(),$1,now(),'lora',1,1,1,0.8),(gen_random_uuid(),$2,now(),'lora',1,1,1,0.8)`,
      [hiveA, hiveB],
    );
    await db.query(
      `insert into public.lora_nodes(dev_eui,claim_hash,owner)
         values ('70b3d57ed0000020',encode(sha256(convert_to('codigo-secreto-1','UTF8')),'hex'),$1)`,
      [ownerA],
    );
    await db.query("select public.delete_account_data($1)", [ownerA]);
    const mine = await db.query(
      "select (select count(*) from public.apiaries where user_id=$1)::int a, (select count(*) from public.hives where id=$2)::int h, (select count(*) from public.edge_verdicts where hive_id=$2)::int v, (select count(*) from public.iot_microphones where hive_id=$2)::int m",
      [ownerA, hiveA],
    );
    expect(mine.rows).toEqual([{ a: 0, h: 0, v: 0, m: 0 }]);
    const theirs = await db.query(
      "select (select count(*) from public.apiaries where user_id=$1)::int a, (select count(*) from public.hives where id=$2)::int h, (select count(*) from public.edge_verdicts where hive_id=$2)::int v",
      [ownerB, hiveB],
    );
    expect(theirs.rows).toEqual([{ a: 1, h: 1, v: 1 }]);
    const node = await db.query("select owner from public.lora_nodes where dev_eui='70b3d57ed0000020'");
    expect(node.rows).toEqual([{ owner: null }]);
    // With the data gone the auth user can be removed (no foreign key blocks it).
    await db.query("delete from auth.users where id=$1", [ownerA]);
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

import { describe, expect, it, vi } from "vitest";
import {
  base64FromBytes,
  crc8,
  encodeEdgePayload,
} from "../functions/_shared/edgePayload";
import {
  createLoraUplinkHandler,
  type UplinkDependencies,
  type VerdictInsert,
} from "../functions/_shared/loraUplinkHandler";

const SECRET = "uplink-secret-for-tests";
const EUI = "70b3d57ed0000001";
const NODE = { id: "00000000-0000-4000-8000-0000000000aa", hive_id: "00000000-0000-4000-8000-0000000000bb" };
const NOW = new Date("2026-11-10T12:00:00.000Z");
const payload = base64FromBytes(
  encodeEdgePayload({ classCode: 1, confidence: 0.9, temperatureC: 27.35, batteryV: 3.9, counter: 3, flags: 0 }),
);

function setup(overrides: Partial<UplinkDependencies> = {}) {
  const inserted: VerdictInsert[] = [];
  const seen = new Set<string>();
  const deps: UplinkDependencies = {
    secret: () => SECRET,
    findNode: async (eui) => (eui === EUI ? NODE : null),
    hiveIsLive: async () => true,
    insertVerdict: async (row) => {
      if (seen.has(row.dedupe_key)) return "duplicate";
      seen.add(row.dedupe_key);
      inserted.push(row);
      return "stored";
    },
    newId: () => "00000000-0000-4000-8000-000000000001",
    now: () => NOW,
    ...overrides,
  };
  return { handler: createLoraUplinkHandler(deps), inserted, deps };
}
const ttn = (extra: Record<string, unknown> = {}, up: Record<string, unknown> = {}) => ({
  end_device_ids: { dev_eui: EUI.toUpperCase() },
  received_at: "2026-11-10T11:59:00.000Z",
  uplink_message: { f_port: 1, f_cnt: 42, frm_payload: payload, session_key_id: "AXyz_01", ...up },
  ...extra,
});
const post = (body: unknown, headers: Record<string, string> = { "x-uplink-secret": SECRET }) =>
  new Request("https://example.test/lora-uplink", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const read = async (r: Response) => (await r.json()) as Record<string, unknown>;

describe("lora-uplink: access", () => {
  it("accepts only POST and refuses to run without a configured secret", async () => {
    const { handler } = setup();
    expect((await handler(new Request("https://example.test/", { method: "GET" }))).status).toBe(405);
    const open = setup({ secret: () => undefined });
    expect((await open.handler(post(ttn()))).status).toBe(500);
    expect(open.inserted).toHaveLength(0);
  });
  it("requires the shared secret in a header or as the Basic password", async () => {
    const { handler, inserted } = setup();
    expect((await handler(post(ttn(), {}))).status).toBe(401);
    expect((await handler(post(ttn(), { "x-uplink-secret": "wrong" }))).status).toBe(401);
    const basic = (pw: string) => `Basic ${btoa(`ttn:${pw}`)}`;
    expect((await handler(post(ttn(), { authorization: basic("wrong") }))).status).toBe(401);
    expect(inserted).toHaveLength(0);
    expect((await handler(post(ttn(), { authorization: basic(SECRET) }))).status).toBe(200);
    expect(inserted).toHaveLength(1);
  });
  it("never echoes the secret", async () => {
    const { handler } = setup();
    const text = await (await handler(post(ttn(), { "x-uplink-secret": "wrong" }))).text();
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("wrong");
  });
});

describe("lora-uplink: message shape", () => {
  it("answers 4xx for malformed requests, which a retry cannot fix", async () => {
    const { handler } = setup();
    expect((await handler(post("{not json"))).status).toBe(400);
    expect((await handler(post({}))).status).toBe(400);
    expect((await handler(post(ttn({ end_device_ids: { dev_eui: "xyz" } })))).status).toBe(400);
    expect((await handler(post(ttn({}, { f_cnt: -1 })))).status).toBe(400);
    expect((await handler(post(ttn({}, { f_cnt: 1.5 })))).status).toBe(400);
    expect((await handler(post(ttn({}, { frm_payload: undefined })))).status).toBe(400);
    expect((await handler(post("x".repeat(70_000)))).status).toBe(413);
  });
  it("ignores other ports and rejects undecodable payloads with 200 so TTN stops retrying", async () => {
    const { handler, inserted } = setup();
    expect(await read(await handler(post(ttn({}, { f_port: 2 }))))).toEqual({ status: "ignored", reason: "port" });
    const bad = encodeEdgePayload({ classCode: 1, confidence: 0.9, temperatureC: 25, batteryV: 3.9 });
    bad[7] = bad[7]! ^ 0xff;
    expect(await read(await handler(post(ttn({}, { frm_payload: base64FromBytes(bad) }))))).toEqual({ status: "rejected", reason: "crc" });
    const short = base64FromBytes(new Uint8Array([1, 2, 3]));
    expect(await read(await handler(post(ttn({}, { frm_payload: short }))))).toEqual({ status: "rejected", reason: "length" });
    expect(await read(await handler(post(ttn({}, { frm_payload: "***" }))))).toEqual({ status: "rejected", reason: "base64" });
    const body = new Uint8Array([0x21, 1, 200, 9, 196, 190, 0]);
    const v2 = base64FromBytes(new Uint8Array([...body, crc8(body)]));
    expect(await read(await handler(post(ttn({}, { frm_payload: v2 }))))).toEqual({ status: "rejected", reason: "format_version" });
    expect(inserted).toHaveLength(0);
  });
});

describe("lora-uplink: storing the verdict", () => {
  it("maps the node to its hive and stores every decoded field with provenance", async () => {
    const { handler, inserted } = setup();
    const response = await handler(post(ttn()));
    expect(response.status).toBe(200);
    expect(await read(response)).toEqual({ status: "stored" });
    expect(inserted[0]).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      hive_id: NODE.hive_id,
      device_id: NODE.id,
      recorded_at: "2026-11-10T11:59:00.000Z",
      source: "lora",
      format_version: 1,
      class_map_version: 1,
      class_code: 1,
      confidence: 0.902, // 0.9 quantised to one byte (230/255)
      temperature_c: 27.35,
      battery_v: 3.9,
      flags: 0,
      uplink_counter: 42,
      dedupe_key: `${EUI}:42:AXyz_01`,
      raw_payload: payload,
      review: null,
      reviewed_at: null,
      review_note: null,
    });
  });
  it("treats a missing counter as 0 and normalises the DevEUI to lowercase", async () => {
    const { handler, inserted } = setup();
    const body = ttn();
    delete (body.uplink_message as Record<string, unknown>).f_cnt;
    delete (body.uplink_message as Record<string, unknown>).session_key_id;
    await handler(post(body));
    expect(inserted[0]).toMatchObject({
      uplink_counter: 0,
      dedupe_key: `${EUI}:0:2026-11-10T11:59:00.000Z`,
    });
  });
  it("is idempotent when TTN retries the same uplink, but stores the next counter", async () => {
    const { handler, inserted } = setup();
    expect(await read(await handler(post(ttn())))).toEqual({ status: "stored" });
    expect(await read(await handler(post(ttn())))).toEqual({ status: "duplicate" });
    expect(await read(await handler(post(ttn({}, { f_cnt: 43 }))))).toEqual({ status: "stored" });
    expect(inserted.map((r) => r.uplink_counter)).toEqual([42, 43]);
  });
  it("does not trust a timestamp from the future or a broken one", async () => {
    const { handler, inserted } = setup();
    await handler(post(ttn({ received_at: "2030-01-01T00:00:00.000Z" })));
    await handler(post(ttn({ received_at: "ayer" }, { f_cnt: 44 })));
    expect(inserted.map((r) => r.recorded_at)).toEqual([NOW.toISOString(), NOW.toISOString()]);
  });
  it("ignores unknown nodes and removed hives without storing anything", async () => {
    const unknown = setup();
    expect(
      await read(await unknown.handler(post(ttn({ end_device_ids: { dev_eui: "70b3d57ed00000ff" } })))),
    ).toEqual({ status: "unknown_device" });
    const removed = setup({ hiveIsLive: async () => false });
    expect(await read(await removed.handler(post(ttn())))).toEqual({ status: "ignored", reason: "hive_removed" });
    expect(unknown.inserted).toHaveLength(0);
    expect(removed.inserted).toHaveLength(0);
  });
  it("answers 5xx when storage fails so TTN retries, without leaking the error", async () => {
    const boom = vi.fn(async () => {
      throw new Error("connection string postgres://secret");
    });
    const { handler } = setup({ insertVerdict: boom });
    const response = await handler(post(ttn()));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("postgres");
    const lookup = setup({ findNode: boom });
    expect((await lookup.handler(post(ttn()))).status).toBe(500);
  });
});

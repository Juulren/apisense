import {
  bytesFromBase64,
  decodeEdgePayload,
  EdgePayloadError,
} from "./edgePayload.ts";

// Receives The Things Stack (TTN v3) uplink webhooks from the hive nodes and
// stores each verdict. Permanent problems with one message answer 200 (so TTN
// does not retry forever); problems that a retry can fix answer 5xx.
const MAX_BODY = 65_536;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
async function equalSecret(left: string, right: string) {
  const hash = async (value: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    );
  const [a, b] = await Promise.all([hash(left), hash(right)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
function basicPassword(header: string | null) {
  const match = header?.match(/^Basic\s+([A-Za-z0-9+/=]+)$/);
  if (!match?.[1]) return null;
  try {
    const decoded = atob(match[1]);
    const at = decoded.indexOf(":");
    return at < 0 ? null : decoded.slice(at + 1);
  } catch {
    return null;
  }
}

export interface VerdictInsert {
  id: string;
  hive_id: string;
  device_id: string;
  recorded_at: string;
  source: "lora";
  format_version: number;
  class_map_version: number;
  class_code: number;
  confidence: number;
  temperature_c: number | null;
  battery_v: number | null;
  flags: number;
  uplink_counter: number;
  dedupe_key: string;
  raw_payload: string;
  review: null;
  reviewed_at: null;
  review_note: null;
}
export interface UplinkDependencies {
  secret(): string | undefined;
  findNode(devEui: string): Promise<{ id: string; hive_id: string } | null>;
  hiveIsLive(hiveId: string): Promise<boolean>;
  insertVerdict(row: VerdictInsert): Promise<"stored" | "duplicate">;
  newId?: () => string;
  now?: () => Date;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function createLoraUplinkHandler(deps: UplinkDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return json({ error: "method" }, 405);
    const secret = deps.secret();
    // Without a configured secret nothing is accepted.
    if (!secret) return json({ error: "not_configured" }, 500);
    const provided =
      request.headers.get("x-uplink-secret") ??
      basicPassword(request.headers.get("authorization"));
    if (!provided || !(await equalSecret(provided, secret)))
      return json({ error: "unauthorized" }, 401);

    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: "too_large" }, 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const ids = isRecord(body) ? body.end_device_ids : undefined;
    const up = isRecord(body) ? body.uplink_message : undefined;
    const rawEui = isRecord(ids) ? ids.dev_eui : undefined;
    if (
      !isRecord(up) ||
      typeof rawEui !== "string" ||
      !/^[0-9a-fA-F]{16}$/.test(rawEui) ||
      typeof up.frm_payload !== "string"
    )
      return json({ error: "invalid_shape" }, 400);
    const devEui = rawEui.toLowerCase();
    // TTN omits zero-valued fields, so a missing counter means 0.
    const counter = up.f_cnt === undefined ? 0 : up.f_cnt;
    if (typeof counter !== "number" || !Number.isInteger(counter) || counter < 0)
      return json({ error: "invalid_shape" }, 400);
    if (up.f_port !== 1) return json({ status: "ignored", reason: "port" });
    const session =
      typeof up.session_key_id === "string" &&
      /^[A-Za-z0-9+/=_-]{1,64}$/.test(up.session_key_id)
        ? up.session_key_id
        : "";

    let uplink;
    try {
      uplink = decodeEdgePayload(bytesFromBase64(up.frm_payload));
    } catch (error) {
      if (error instanceof EdgePayloadError)
        return json({ status: "rejected", reason: error.code });
      throw error;
    }

    const now = (deps.now ?? (() => new Date()))();
    const received =
      isRecord(body) && typeof body.received_at === "string"
        ? Date.parse(body.received_at)
        : NaN;
    // A message cannot come from the future.
    const recordedAt = new Date(
      Number.isFinite(received) && received <= now.getTime() + 600_000
        ? received
        : now.getTime(),
    ).toISOString();

    try {
      const node = await deps.findNode(devEui);
      if (!node) return json({ status: "unknown_device" });
      if (!(await deps.hiveIsLive(node.hive_id)))
        return json({ status: "ignored", reason: "hive_removed" });
      // Without a session id (ABP, or a node that restarted its counter) the
      // message time keeps new uplinks from colliding with old ones; a TTN retry
      // carries the same time, so it is still recognised as a duplicate.
      const keyTail =
        session || (isRecord(body) && typeof body.received_at === "string" ? body.received_at.slice(0, 40) : "");
      const outcome = await deps.insertVerdict({
        id: (deps.newId ?? (() => crypto.randomUUID()))(),
        hive_id: node.hive_id,
        device_id: node.id,
        recorded_at: recordedAt,
        source: "lora",
        format_version: uplink.formatVersion,
        class_map_version: uplink.classMapVersion,
        class_code: uplink.classCode,
        confidence: uplink.confidence,
        temperature_c: uplink.temperatureC,
        battery_v: uplink.batteryV,
        flags: uplink.flags,
        uplink_counter: counter,
        dedupe_key: `${devEui}:${counter}:${keyTail}`,
        raw_payload: up.frm_payload,
        review: null,
        reviewed_at: null,
        review_note: null,
      });
      return json({ status: outcome });
    } catch {
      // Storage problem: a retry from TTN can fix it.
      return json({ error: "storage" }, 500);
    }
  };
}

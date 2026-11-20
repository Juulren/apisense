// Sends the pending alert events to the phones of the account that owns them.
// Called every minute by pg_cron with the shared cron secret. The messages are
// neutral by construction (see the migration): they never state a cause.
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

export interface PushEvent {
  id: string;
  user_id: string;
  hive_id: string;
  kind: "verdict" | "node_silent";
  title: string;
  body: string;
}
export type SendResult = "ok" | "invalid" | "error";
export interface SendPushDependencies {
  cronSecret(): string | undefined;
  /** Firebase credentials present? Without them nothing is sent or consumed. */
  configured(): boolean;
  /** Unsent events of the last two hours (older ones are expired by this call). */
  pending(limit: number): Promise<PushEvent[]>;
  tokensFor(userId: string): Promise<string[]>;
  send(
    token: string,
    message: { title: string; body: string; data: Record<string, string> },
  ): Promise<SendResult>;
  markSent(eventId: string): Promise<void>;
  deleteToken(token: string): Promise<void>;
}

export function createSendPushHandler(deps: SendPushDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return json({ error: "method" }, 405);
    const secret = deps.cronSecret();
    if (!secret) return json({ error: "not_configured" }, 500);
    const supplied = request.headers.get("x-cron-secret");
    if (!supplied || !(await equalSecret(supplied, secret)))
      return json({ error: "unauthorized" }, 401);
    if (!deps.configured()) return json({ status: "push_not_configured" });

    let sent = 0,
      failed = 0,
      skipped = 0;
    try {
      for (const event of await deps.pending(50)) {
        const tokens = await deps.tokensFor(event.user_id);
        if (tokens.length === 0) {
          // Nobody to notify: consume it so it does not pile up.
          await deps.markSent(event.id);
          skipped++;
          continue;
        }
        let delivered = false;
        for (const token of tokens) {
          const result = await deps.send(token, {
            title: event.title,
            body: event.body,
            data: { kind: event.kind, hive_id: event.hive_id },
          });
          if (result === "ok") delivered = true;
          else if (result === "invalid") await deps.deleteToken(token);
          else failed++;
        }
        // Only a delivered (or tokenless) event is consumed; a transient failure retries next minute.
        if (delivered) {
          await deps.markSent(event.id);
          sent++;
        } else if ((await deps.tokensFor(event.user_id)).length === 0) {
          await deps.markSent(event.id);
          skipped++;
        }
      }
    } catch {
      return json({ error: "storage" }, 500);
    }
    return json({ status: "ok", sent, failed, skipped });
  };
}

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { summaryIdentity, uuidFromDigest } from "./summary.ts";
import { SAMPLE_PAGE_SIZE, summarizePages } from "./summaryPages.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function equalSecret(left: string, right: string) {
  const hash = async (value: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    );
  const [a, b] = await Promise.all([hash(left), hash(right)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
interface Dependencies {
  cronSecret(): string | undefined;
  client(privileged: boolean, authorization?: string): SupabaseClient;
  now?: () => Date;
}
interface HiveJob {
  hive_id: string;
  check_interval_minutes: number;
  window_end: string;
  lease_token?: string;
}
async function generate(client: SupabaseClient, job: HiveJob, now: Date) {
  const start = new Date(
    Date.parse(job.window_end) - job.check_interval_minutes * 60000,
  ).toISOString();
  const summary = await summarizePages(async (cursor) => {
    let query = client
      .from("audio_samples")
      .select(
        "id,recorded_at,acoustic_classification,confidence_score,classifier_version,source,dominant_freq_hz",
      )
      .eq("hive_id", job.hive_id)
      .neq("source", "simulator")
      .is("deleted_at", null)
      .gte("recorded_at", start)
      .lte("recorded_at", job.window_end)
      .order("recorded_at")
      .order("id")
      .limit(SAMPLE_PAGE_SIZE);
    if (cursor)
      query = query.or(
        `recorded_at.gt.${cursor.recorded_at},and(recorded_at.eq.${cursor.recorded_at},id.gt.${cursor.id})`,
      );
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }, job.check_interval_minutes);
  if (!summary) return null;
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      summaryIdentity(job.hive_id, summary.period_start, summary.period_end),
    ),
  );
  const id = uuidFromDigest(
    Array.from(new Uint8Array(hash), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join(""),
  );
  const { error } = await client.from("ai_summaries").upsert(
    {
      id,
      hive_id: job.hive_id,
      ...summary,
      created_at: now.toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) throw error;
  return { id, hive_id: job.hive_id, status: summary.overall_status };
}
async function finish(
  client: SupabaseClient,
  job: HiveJob,
  succeeded: boolean,
) {
  const { data, error } = await client.rpc("finish_hive_summary_job", {
    job_hive_id: job.hive_id,
    job_lease_token: job.lease_token,
    succeeded,
  });
  if (error || data !== true) throw new Error("Unable to finish leased job");
}
export function createSummaryHandler(dependencies: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS")
      return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return json({ error: "Method not allowed" }, 405);
    try {
      if (Number(request.headers.get("content-length") ?? 0) > 4096)
        return json({ error: "Request too large" }, 413);
      const raw = await request.text();
      if (raw.length > 4096) return json({ error: "Request too large" }, 413);
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        return json({ error: "Invalid body" }, 400);
      for (const key of ["hive_id", "after_hive_id"]) {
        if (
          body[key] !== undefined &&
          (typeof body[key] !== "string" || !uuid.test(body[key]))
        )
          return json({ error: `Invalid ${key}` }, 400);
      }
      if (body.hive_id && body.after_hive_id)
        return json({ error: "Use hive_id or after_hive_id" }, 400);
      const configured = dependencies.cronSecret();
      const supplied = request.headers.get("x-cron-secret");
      const cron =
        !!configured && !!supplied && (await equalSecret(supplied, configured));
      const authorization = request.headers.get("authorization");
      if (!cron && !authorization?.startsWith("Bearer "))
        return json({ error: "Unauthorized" }, 401);
      const client = dependencies.client(
        cron,
        cron ? undefined : authorization!,
      );
      if (!cron) {
        const { data, error } = await client.auth.getUser(
          authorization!.slice(7),
        );
        if (error || !data.user) return json({ error: "Unauthorized" }, 401);
      }
      const now = (dependencies.now ?? (() => new Date()))();
      let jobs: HiveJob[];
      let nextHiveId: string | null = null;
      if (cron) {
        if (body.hive_id || body.after_hive_id)
          return json(
            { error: "Cron drains the queue without a hive filter" },
            400,
          );
        const { data, error } = await client.rpc("claim_hive_summary_jobs", {
          batch_size: 10,
        });
        if (error) throw error;
        jobs = data ?? [];
      } else {
        let query = client
          .from("hives")
          .select("id,apiaries!inner(check_interval_minutes)")
          .is("deleted_at", null)
          .is("apiaries.deleted_at", null)
          .order("id");
        if (body.hive_id) query = query.eq("id", body.hive_id);
        if (body.after_hive_id) query = query.gt("id", body.after_hive_id);
        const { data, error } = await query.limit(51);
        if (error) throw error;
        const hives = data ?? [];
        if (hives.length > 50) nextHiveId = hives[49].id;
        jobs = hives.slice(0, 50).map((hive) => ({
          hive_id: hive.id,
          check_interval_minutes: (
            hive.apiaries as unknown as { check_interval_minutes: number }
          ).check_interval_minutes,
          window_end: now.toISOString(),
        }));
      }
      const summaries = [];
      let failed = 0;
      for (const job of jobs) {
        try {
          const result = await generate(client, job, now);
          if (cron) await finish(client, job, true);
          if (result) summaries.push(result);
        } catch {
          if (!cron) throw new Error("Summary generation failed");
          failed++;
          try {
            await finish(client, job, false);
          } catch {
            /* Lease expires after a disconnected worker. */
          }
        }
      }
      return json(
        {
          summaries,
          hives_considered: jobs.length,
          failed,
          next_hive_id: nextHiveId,
        },
        failed ? 503 : 200,
      );
    } catch (error) {
      console.error(
        "generate-hive-summary failed",
        error instanceof Error ? error.name : "unknown",
      );
      return json({ error: "Summary generation failed" }, 500);
    }
  };
}

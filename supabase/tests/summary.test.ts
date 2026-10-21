import { describe, expect, it, vi } from "vitest";
import { summarize, summaryWindow } from "../functions/_shared/summary";
import {
  summarizePages,
  type PagedSample,
} from "../functions/_shared/summaryPages";
import { createSummaryHandler } from "../functions/_shared/summaryHandler";

const at = "2026-10-21T12:00:00.000Z";
const samples = (count: number): PagedSample[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i.toString().padStart(8, "0"),
    recorded_at: at,
    acoustic_classification: i % 3 ? "queenless" : "healthy",
    confidence_score: 0.95,
    classifier_version: "onnx:test",
    source: "ble",
    dominant_freq_hz: 250,
  }));
describe("Cloud summary pagination", () => {
  it("includes more than 1000 clips, including equal timestamps, without changing the summary", async () => {
    const rows = samples(1257);
    const page = vi.fn(async (cursor) =>
      rows.filter((row) => !cursor || row.id > cursor.id).slice(0, 200),
    );
    const result = await summarizePages(page, 15);
    expect(result).toEqual({ ...summaryWindow(rows, 15), ...summarize(rows) });
    expect(result?.samples_analyzed_count).toBe(1257);
    expect(result?.overall_status).toBe("critical");
    expect(page).toHaveBeenCalledTimes(7);
  });
  it("does not publish a truncated result if a later page fails", async () => {
    let calls = 0;
    await expect(
      summarizePages(async () => {
        if (calls++) throw new Error("connection interrupted");
        return samples(200);
      }, 15),
    ).rejects.toThrow("connection interrupted");
  });
  it("detects repeated pages and invalid timestamps, and handles an empty window", async () => {
    await expect(summarizePages(async () => samples(200), 15)).rejects.toThrow(
      "no avanzó",
    );
    await expect(
      summarizePages(
        async () => [{ ...samples(1)[0], recorded_at: "invalid" }],
        15,
      ),
    ).rejects.toThrow("Fecha");
    expect(await summarizePages(async () => [], 15)).toBeNull();
  });
  it("keeps local period derivation working with windows above the JS argument limit", () => {
    expect(summaryWindow(samples(150000), 15).period_end).toBe(
      "2026-10-21T12:00:00.001Z",
    );
  });
});

const post = (headers = {}, body = "{}") =>
  new Request("https://example.invalid", { method: "POST", headers, body });
describe("Summary authorization", () => {
  it("rejects absent, incorrect and unconfigured cron credentials before creating a privileged client", async () => {
    const client = vi.fn();
    for (const configured of [undefined, "test-only-cron-secret"]) {
      const handler = createSummaryHandler({
        client,
        cronSecret: () => configured,
      });
      expect((await handler(post())).status).toBe(401);
      expect(
        (await handler(post({ "x-cron-secret": "incorrect" }))).status,
      ).toBe(401);
    }
    expect(client).not.toHaveBeenCalled();
  });
  it("validates a bearer token with Auth before reading data", async () => {
    const from = vi.fn();
    const getUser = vi.fn(async () => ({
      data: { user: null },
      error: new Error("invalid"),
    }));
    const client = vi.fn(() => ({ auth: { getUser }, from }) as never);
    const handler = createSummaryHandler({
      client,
      cronSecret: () => "test-only-cron-secret",
    });
    expect(
      (await handler(post({ authorization: "Bearer invalid" }))).status,
    ).toBe(401);
    expect(client).toHaveBeenCalledWith(false, "Bearer invalid");
    expect(from).not.toHaveBeenCalled();
  });
  it("rejects malformed bodies and cursors", async () => {
    const client = vi.fn();
    const handler = createSummaryHandler({
      client,
      cronSecret: () => undefined,
    });
    for (const body of ["null", "[]", "{", '{"after_hive_id":"bad"}']) {
      expect((await handler(post({}, body))).status).toBe(400);
    }
    expect(client).not.toHaveBeenCalled();
  });
  it("uses the queue only after validating the cron secret", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const client = vi.fn(() => ({ rpc }) as never);
    const handler = createSummaryHandler({
      client,
      cronSecret: () => "test-only-cron-secret",
    });
    const response = await handler(
      post({ "x-cron-secret": "test-only-cron-secret" }),
    );
    expect(response.status).toBe(200);
    expect(client).toHaveBeenCalledWith(true, undefined);
    expect(rpc).toHaveBeenCalledWith("claim_hive_summary_jobs", {
      batch_size: 10,
    });
  });
});

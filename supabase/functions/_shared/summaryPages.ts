import { SummaryAccumulator, type SummarySample } from "./summary.ts";

export interface SampleCursor {
  recorded_at: string;
  id: string;
}
export interface PagedSample extends SummarySample {
  id: string;
}
export const SAMPLE_PAGE_SIZE = 200;

// Pages are ordered by recorded_at, id inside a fixed server-side time window.
// Accumulate counts rather than retaining every clip in the Edge Function.
export async function summarizePages(
  page: (after: SampleCursor | null) => Promise<PagedSample[]>,
  intervalMinutes: number,
) {
  const aggregate = new SummaryAccumulator();
  let cursor: SampleCursor | null = null;
  let count = 0;
  for (;;) {
    const rows = await page(cursor);
    if (rows.length > SAMPLE_PAGE_SIZE)
      throw new Error("Página demasiado grande");
    for (const row of rows) {
      if (
        cursor &&
        (Date.parse(row.recorded_at) < Date.parse(cursor.recorded_at) ||
          (Date.parse(row.recorded_at) === Date.parse(cursor.recorded_at) &&
            row.id <= cursor.id))
      )
        throw new Error("La paginación no avanzó");
      aggregate.add(row);
      cursor = { recorded_at: row.recorded_at, id: row.id };
      count++;
    }
    if (rows.length < SAMPLE_PAGE_SIZE) break;
  }
  return count
    ? { ...aggregate.window(intervalMinutes), ...aggregate.result() }
    : null;
}

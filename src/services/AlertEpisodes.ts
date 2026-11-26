import type { Repository } from "../db/Repository";
import type { EdgeVerdict, VerdictReview } from "../db/types";
import {
  isAlert,
  MAX_REVIEW_NOTE,
  nodeWarnings,
  pendingAlerts,
} from "./EdgeVerdicts";

// A node sends a message every few minutes, so one problem raises many alerts.
// The app shows and reviews them as one episode.

/** Two hours without alerts close an episode: the same spacing as the push notifications. */
export const EPISODE_GAP_MS = 2 * 3_600_000;

export interface AlertEpisode {
  hive_id: string;
  /** Every alert the card stands for; reviewing it covers exactly these. */
  ids: string[];
  first: string;
  last: string;
  latest: EdgeVerdict;
  /** The node's own warnings in any of its messages. */
  warnings: string[];
}

/** The alerts nobody has looked at, as episodes, the most recent first. */
export function alertEpisodes(verdicts: EdgeVerdict[]): AlertEpisode[] {
  const open = new Map<string, AlertEpisode>();
  const all: AlertEpisode[] = [];
  for (const v of pendingAlerts(verdicts).reverse()) {
    const current = open.get(v.hive_id);
    if (
      current &&
      Date.parse(v.recorded_at) - Date.parse(current.last) <= EPISODE_GAP_MS
    ) {
      current.ids.push(v.id);
      current.last = v.recorded_at;
      current.latest = v;
      current.warnings = [...new Set([...current.warnings, ...nodeWarnings(v)])];
      continue;
    }
    const next = {
      hive_id: v.hive_id,
      ids: [v.id],
      first: v.recorded_at,
      last: v.recorded_at,
      latest: v,
      warnings: nodeWarnings(v),
    };
    open.set(v.hive_id, next);
    all.push(next);
  }
  return all.sort((a, b) => b.last.localeCompare(a.last));
}

/** All that waits for review in one hive, across its episodes. */
export function hivePending(episodes: AlertEpisode[], hiveId: string) {
  const own = episodes.filter((e) => e.hive_id === hiveId);
  if (!own.length) return undefined;
  return {
    count: own.reduce((n, e) => n + e.ids.length, 0),
    since: own.reduce((a, e) => (e.first < a ? e.first : a), own[0]!.first),
    // Episodes come most recent first.
    latest: own[0]!.latest,
    warnings: [...new Set(own.flatMap((e) => e.warnings))],
  };
}

export const episodeCount = (count: number) =>
  `${count} ${count === 1 ? "aviso" : "avisos"} de sonido diferente`;

const two = (n: number) => String(n).padStart(2, "0");
/** "22:42" for today, "24/11 09:05" for another day, in the phone's time. */
export function timeText(iso: string, now = new Date()) {
  const d = new Date(iso);
  const time = `${two(d.getHours())}:${two(d.getMinutes())}`;
  return d.toDateString() === now.toDateString()
    ? time
    : `${d.getDate()}/${d.getMonth() + 1} ${time}`;
}

export interface ReviewedGroup {
  key: string;
  hive_id: string;
  review: VerdictReview;
  note: string | null;
  reviewedAt: string;
  count: number;
}

/** What was reviewed together, the latest review first. */
export function reviewedGroups(verdicts: EdgeVerdict[], limit = 10) {
  const groups = new Map<string, ReviewedGroup>();
  for (const v of verdicts) {
    if (!isAlert(v) || v.review === null) continue;
    const reviewedAt = v.reviewed_at ?? "";
    const key = `${v.hive_id}|${reviewedAt}|${v.review}`;
    const group = groups.get(key);
    if (group) group.count++;
    else
      groups.set(key, {
        key,
        hive_id: v.hive_id,
        review: v.review,
        note: v.review_note,
        reviewedAt,
        count: 1,
      });
  }
  return [...groups.values()]
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
    .slice(0, limit);
}

/** Marks every alert of an episode at once; resolves to how many were saved. */
export async function reviewEpisode(
  repo: Repository,
  ids: string[],
  review: VerdictReview,
  note = "",
  now = new Date(),
) {
  const trimmed = note.trim();
  if (trimmed.length > MAX_REVIEW_NOTE)
    throw new Error(`Usa máximo ${MAX_REVIEW_NOTE} caracteres en la nota`);
  const saved = await repo.reviewVerdicts(ids, {
    review,
    reviewed_at: now.toISOString(),
    review_note: trimmed || null,
  });
  if (!saved)
    throw new Error("La alerta ya no está disponible o ya se revisó");
  return saved;
}

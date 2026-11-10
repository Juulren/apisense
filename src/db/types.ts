export type SqlValue = string | number | null;
export interface BaseRow {
  id: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
  local_revision: number;
}
export interface Apiary extends BaseRow {
  user_id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  check_interval_minutes: number;
  region_preset: RegionPreset | null;
  seasons_json: string | null;
  weather_enabled: number;
  checkin_frequency: CheckinFrequency;
}
export type CheckinFrequency = "daily" | "weekly" | "off";
// Only calendars with some documented basis are offered; "custom" starts empty.
export type RegionPreset = "yucatan" | "custom";
export interface Hive extends BaseRow {
  apiary_id: string;
  code: string;
  queen_status: string;
  health_score: number | null;
  last_audio_check_at: string | null;
}
export interface Microphone extends BaseRow {
  hive_id: string;
  mac_address: string;
  firmware_version: string;
  battery_level: number;
  sampling_rate_hz: number;
  is_online: number;
  last_seen_at: string | null;
  calibration_db: number;
  /** LoRaWAN DevEUI (16 lowercase hex): links the node to its hive on the server. */
  dev_eui: string | null;
}
export type AcousticClass =
  "healthy" | "swarming" | "queenless" | "pest_disturbance" | "unknown";
export interface AudioSample extends BaseRow {
  hive_id: string;
  device_id: string;
  recorded_at: string;
  duration_seconds: number;
  dominant_freq_hz: number;
  amplitude_db: number;
  mfcc_features_json: string;
  audio_file_url: string | null;
  local_audio_uri: string | null;
  acoustic_classification: AcousticClass;
  confidence_score: number;
  source: "simulator" | "ble" | "mqtt";
  classifier_version: string;
}
export type OverallStatus = "optimal" | "warning" | "critical";
export interface AiSummary extends BaseRow {
  hive_id: string;
  period_start: string;
  period_end: string;
  overall_status: OverallStatus;
  summary_text: string;
  recommended_action: string;
  samples_analyzed_count: number;
  created_at: string;
  engine_version: string;
}
export interface Inspection extends BaseRow {
  hive_id: string;
  inspected_at: string;
  notes: string;
  tags_json: string;
  queen_seen: number;
  queen_state: QueenState | null;
  eggs_state: EggsState | null;
  queen_cells: QueenCells | null;
  activity: Level3 | null;
  population: Trend | null;
  stores: StoresLevel | null;
}
export type Level3 = "low" | "normal" | "high";
export type StoresLevel = "low" | "medium" | "high";
export type Trend = "down" | "stable" | "up";
export type QueenState = "seen" | "not_seen" | "virgin_seen";
export type EggsState = "none" | "fresh" | "multiple";
export type QueenCells = "none" | "present";
export type BroodStage = "unknown" | "egg" | "larva" | "capped" | "emerged";
export interface BroodCycle extends BaseRow {
  hive_id: string;
  cohort_label: string;
  started_on: string;
  state: "active" | "emerged" | "stopped";
  observed_stage: BroodStage;
  observed_at: string | null;
  ended_at: string | null;
}
export type VerdictSource = "lora" | "ble" | "mqtt" | "simulator";
export type VerdictReview = "seen" | "false_alarm" | "confirmed";
/** What the node's classifier said. It never states a cause: see edgePayload.ts. */
export interface EdgeVerdict extends BaseRow {
  hive_id: string;
  device_id: string | null;
  recorded_at: string;
  source: VerdictSource;
  format_version: number;
  class_map_version: number;
  class_code: number;
  confidence: number;
  temperature_c: number | null;
  battery_v: number | null;
  flags: number;
  uplink_counter: number | null;
  dedupe_key: string | null;
  raw_payload: string | null;
  review: VerdictReview | null;
  reviewed_at: string | null;
  review_note: string | null;
}
export interface EntityMap {
  apiaries: Apiary;
  hives: Hive;
  iot_microphones: Microphone;
  audio_samples: AudioSample;
  ai_summaries: AiSummary;
  inspections: Inspection;
  brood_cycles: BroodCycle;
  edge_verdicts: EdgeVerdict;
}
export const TABLES = [
  "apiaries",
  "hives",
  "iot_microphones",
  "audio_samples",
  "ai_summaries",
  "inspections",
  "brood_cycles",
  "edge_verdicts",
] as const;
export type Table = (typeof TABLES)[number];
// Columns added after 1.0 may be omitted on write: the database default (or
// NULL) applies on insert and an existing value is kept on update.
type Defaulted = {
  apiaries:
    | "region_preset"
    | "seasons_json"
    | "weather_enabled"
    | "checkin_frequency";
  inspections:
    | "queen_state"
    | "eggs_state"
    | "queen_cells"
    | "activity"
    | "population"
    | "stores";
  iot_microphones: "dev_eui";
  edge_verdicts:
    | "device_id"
    | "temperature_c"
    | "battery_v"
    | "flags"
    | "uplink_counter"
    | "dedupe_key"
    | "raw_payload"
    | "review"
    | "reviewed_at"
    | "review_note";
};
type DefaultedKeys<K extends Table> = K extends keyof Defaulted
  ? Defaulted[K]
  : never;
export type Input<K extends Table> = Omit<
  EntityMap[K],
  keyof BaseRow | DefaultedKeys<K>
> &
  Partial<Pick<EntityMap[K], Extract<DefaultedKeys<K>, keyof EntityMap[K]>>> & {
    id?: string;
    deleted_at?: string | null;
  };
export type AnyRow = EntityMap[Table];
export interface QueueItem {
  table_name: Table;
  record_id: string;
  revision: number;
  attempts: number;
  next_retry_at: string;
  last_error: string | null;
  row: AnyRow;
}
export interface SqlPort {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  close(): Promise<void>;
}

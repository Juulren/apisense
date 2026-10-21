export const columns = {
  apiaries: [
    "user_id",
    "name",
    "latitude",
    "longitude",
    "check_interval_minutes",
  ],
  hives: [
    "apiary_id",
    "code",
    "queen_status",
    "health_score",
    "last_audio_check_at",
  ],
  iot_microphones: [
    "hive_id",
    "mac_address",
    "firmware_version",
    "battery_level",
    "sampling_rate_hz",
    "is_online",
    "last_seen_at",
    "calibration_db",
  ],
  audio_samples: [
    "hive_id",
    "device_id",
    "recorded_at",
    "duration_seconds",
    "dominant_freq_hz",
    "amplitude_db",
    "mfcc_features_json",
    "audio_file_url",
    "local_audio_uri",
    "acoustic_classification",
    "confidence_score",
    "source",
    "classifier_version",
  ],
  ai_summaries: [
    "hive_id",
    "period_start",
    "period_end",
    "overall_status",
    "summary_text",
    "recommended_action",
    "samples_analyzed_count",
    "created_at",
    "engine_version",
  ],
  inspections: ["hive_id", "inspected_at", "notes", "tags_json", "queen_seen"],
} as const;
const common = `id TEXT PRIMARY KEY NOT NULL, updated_at TEXT NOT NULL, synced_at TEXT, deleted_at TEXT, local_revision INTEGER NOT NULL DEFAULT 0`;
export const migrationV1 = `
CREATE TABLE IF NOT EXISTS apiaries (${common}, user_id TEXT NOT NULL, name TEXT NOT NULL, latitude REAL, longitude REAL, check_interval_minutes INTEGER NOT NULL DEFAULT 15 CHECK(check_interval_minutes BETWEEN 1 AND 10080));
CREATE TABLE IF NOT EXISTS hives (${common}, apiary_id TEXT NOT NULL REFERENCES apiaries(id), code TEXT NOT NULL, queen_status TEXT NOT NULL DEFAULT 'unknown', health_score REAL CHECK(health_score BETWEEN 0 AND 100), last_audio_check_at TEXT);
CREATE TABLE IF NOT EXISTS iot_microphones (${common}, hive_id TEXT NOT NULL REFERENCES hives(id), mac_address TEXT NOT NULL, firmware_version TEXT NOT NULL, battery_level REAL NOT NULL CHECK(battery_level BETWEEN 0 AND 100), sampling_rate_hz INTEGER NOT NULL CHECK(sampling_rate_hz BETWEEN 1000 AND 96000), is_online INTEGER NOT NULL CHECK(is_online IN (0,1)), last_seen_at TEXT, calibration_db REAL NOT NULL DEFAULT 0, UNIQUE(id,hive_id));
CREATE TABLE IF NOT EXISTS audio_samples (${common}, hive_id TEXT NOT NULL REFERENCES hives(id), device_id TEXT NOT NULL, recorded_at TEXT NOT NULL, duration_seconds REAL NOT NULL CHECK(duration_seconds > 0 AND duration_seconds <= 30), dominant_freq_hz REAL NOT NULL CHECK(dominant_freq_hz >= 0), amplitude_db REAL NOT NULL, mfcc_features_json TEXT NOT NULL, audio_file_url TEXT, local_audio_uri TEXT, acoustic_classification TEXT NOT NULL, confidence_score REAL NOT NULL CHECK(confidence_score BETWEEN 0 AND 1), source TEXT NOT NULL CHECK(source IN ('simulator','ble','mqtt')), classifier_version TEXT NOT NULL, FOREIGN KEY(device_id,hive_id) REFERENCES iot_microphones(id,hive_id));
CREATE TABLE IF NOT EXISTS ai_summaries (${common}, hive_id TEXT NOT NULL REFERENCES hives(id), period_start TEXT NOT NULL, period_end TEXT NOT NULL, overall_status TEXT NOT NULL CHECK(overall_status IN ('optimal','warning','critical')), summary_text TEXT NOT NULL, recommended_action TEXT NOT NULL, samples_analyzed_count INTEGER NOT NULL CHECK(samples_analyzed_count > 0), created_at TEXT NOT NULL, engine_version TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inspections (${common}, hive_id TEXT NOT NULL REFERENCES hives(id), inspected_at TEXT NOT NULL, notes TEXT NOT NULL, tags_json TEXT NOT NULL, queen_seen INTEGER NOT NULL CHECK(queen_seen IN (0,1)));
CREATE TABLE IF NOT EXISTS sync_queue (table_name TEXT NOT NULL, record_id TEXT NOT NULL, revision INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_retry_at TEXT NOT NULL, last_error TEXT, PRIMARY KEY(table_name,record_id));
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS audio_hive_time ON audio_samples(hive_id,recorded_at);
CREATE INDEX IF NOT EXISTS summary_hive_time ON ai_summaries(hive_id,period_end);
CREATE INDEX IF NOT EXISTS queue_retry ON sync_queue(next_retry_at);
PRAGMA user_version = 1;
`;

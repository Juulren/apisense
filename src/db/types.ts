export type SqlValue = string | number | null;
export interface BaseRow { id: string; updated_at: string; synced_at: string | null; deleted_at: string | null; local_revision: number }
export interface Apiary extends BaseRow { user_id: string; name: string; latitude: number | null; longitude: number | null; check_interval_minutes: number }
export interface Hive extends BaseRow { apiary_id: string; code: string; queen_status: string; health_score: number | null; last_audio_check_at: string | null }
export interface Microphone extends BaseRow { hive_id: string; mac_address: string; firmware_version: string; battery_level: number; sampling_rate_hz: number; is_online: number; last_seen_at: string | null; calibration_db: number }
export type AcousticClass = 'healthy' | 'swarming' | 'queenless' | 'pest_disturbance' | 'unknown';
export interface AudioSample extends BaseRow { hive_id: string; device_id: string; recorded_at: string; duration_seconds: number; dominant_freq_hz: number; amplitude_db: number; mfcc_features_json: string; audio_file_url: string | null; local_audio_uri: string | null; acoustic_classification: AcousticClass; confidence_score: number; source: 'simulator' | 'ble' | 'mqtt'; classifier_version: string }
export type OverallStatus = 'optimal' | 'warning' | 'critical';
export interface AiSummary extends BaseRow { hive_id: string; period_start: string; period_end: string; overall_status: OverallStatus; summary_text: string; recommended_action: string; samples_analyzed_count: number; created_at: string; engine_version: string }
export interface Inspection extends BaseRow { hive_id: string; inspected_at: string; notes: string; tags_json: string; queen_seen: number }
export interface EntityMap { apiaries: Apiary; hives: Hive; iot_microphones: Microphone; audio_samples: AudioSample; ai_summaries: AiSummary; inspections: Inspection }
export const TABLES = ['apiaries', 'hives', 'iot_microphones', 'audio_samples', 'ai_summaries', 'inspections'] as const;
export type Table = typeof TABLES[number];
export type Input<K extends Table> = Omit<EntityMap[K], keyof BaseRow> & { id?: string; deleted_at?: string | null };
export type AnyRow = EntityMap[Table];
export interface QueueItem { table_name: Table; record_id: string; revision: number; attempts: number; next_retry_at: string; last_error: string | null; row: AnyRow }
export interface SqlPort { exec(sql: string): Promise<void>; run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>; all<T>(sql: string, params?: SqlValue[]): Promise<T[]>; close(): Promise<void> }

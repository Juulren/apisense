import { randomUUID } from "expo-crypto";
import type { Repository } from "../db/Repository";
import type { AudioIngestionService } from "../services/iot/AudioIngestionService";
import type { HiveSummaryEngine } from "../services/ai/HiveSummaryEngine";
import { simulate } from "../services/iot/Simulator";
export const DEMO_USER = "00000000-0000-4000-8000-000000000001";
export async function seedDemo(
  repo: Repository,
  ingestion: AudioIngestionService,
  summaries: HiveSummaryEngine,
) {
  if (await repo.setting("demo_seeded")) return;
  const apiaryId = "00000000-0000-4000-8000-000000000010";
  if (!(await repo.get("apiaries", apiaryId)))
    await repo.save("apiaries", {
      id: apiaryId,
      user_id: DEMO_USER,
      name: "Apiario Central · Maní",
      latitude: 20.388,
      longitude: -89.323,
      check_interval_minutes: 15,
    });
  for (let i = 1; i <= 8; i++) {
    const hiveId = `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`;
    const micId = `00000000-0000-4000-8000-${String(200 + i).padStart(12, "0")}`;
    if (!(await repo.get("hives", hiveId)))
      await repo.save("hives", {
        id: hiveId,
        apiary_id: apiaryId,
        code: `Colmena ${String(i).padStart(2, "0")}`,
        queen_status: "unknown",
        health_score: null,
        last_audio_check_at: null,
      });
    if (!(await repo.get("iot_microphones", micId)))
      await repo.save("iot_microphones", {
        id: micId,
        hive_id: hiveId,
        mac_address: `SIM-${String(i).padStart(2, "0")}`,
        firmware_version: "simulator-v1",
        battery_level: 98 - i,
        sampling_rate_hz: 16000,
        is_online: 1,
        last_seen_at: new Date().toISOString(),
        calibration_db: 0,
      });
    await ingestion.ingest(
      simulate(
        i === 4 ? "swarming" : "healthy",
        { id: randomUUID(), hive_id: hiveId, device_id: micId },
        i,
      ),
      "simulator",
    );
    await summaries.generate(hiveId);
  }
  await repo.setSetting("name", "Mateo");
  await repo.setSetting("demo_seeded", "1");
}

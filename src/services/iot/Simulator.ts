import { fromByteArray } from "base64-js";
import type { TelemetryFrame } from "./protocol";
import { encodeWav } from "./wav";
export type SimulationPattern =
  "healthy" | "swarming" | "queenless" | "pest_disturbance";
export function simulate(
  pattern: SimulationPattern,
  identity: { id: string; hive_id: string; device_id: string },
  seed = 42,
  at = new Date(),
): TelemetryFrame {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const frequencies = {
    healthy: 250,
    swarming: 450,
    queenless: 510,
    pest_disturbance: 180,
  };
  const frequency = frequencies[pattern];
  const rate = 16000,
    duration = 5,
    pcm = new Float32Array(rate * duration);
  for (let i = 0; i < pcm.length; i++) {
    const t = i / rate;
    const noise = random() * 2 - 1;
    const modulation =
      pattern === "queenless"
        ? Math.sin(t * 19) * 0.55
        : Math.sin(t * 5) * 0.08;
    const tone =
      Math.sin(2 * Math.PI * frequency * t) * (0.15 + modulation * 0.1) +
      Math.sin(2 * Math.PI * frequency * 2 * t) * 0.04;
    pcm[i] =
      pattern === "pest_disturbance"
        ? noise * 0.3 * (Math.sin(t * 43) > 0.7 ? 1 : 0.1) + tone * 0.3
        : tone + noise * 0.01;
  }
  let energy = 0;
  pcm.forEach((x) => (energy += x * x));
  const rms = Math.sqrt(energy / pcm.length);
  return {
    version: 1,
    ...identity,
    recorded_at: at.toISOString(),
    duration_seconds: duration,
    sampling_rate_hz: rate,
    dominant_freq_hz: frequency,
    amplitude_db: 20 * Math.log10(Math.max(rms, 1e-8)),
    mfcc_features: Array.from(
      { length: 13 },
      (_, i) => Math.cos(i + frequency / 100) * 5,
    ),
    battery_level: 98,
    wav_base64: fromByteArray(encodeWav(pcm, rate)),
  };
}

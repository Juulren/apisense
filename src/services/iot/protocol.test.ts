import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { JsonLineFramer, validateFrame } from "./protocol";
import { simulate } from "./Simulator";
import { decodeWav } from "./wav";
import { toByteArray } from "base64-js";
const identity = () => ({
  id: randomUUID(),
  hive_id: randomUUID(),
  device_id: randomUUID(),
});
describe("IoT protocol", () => {
  it("reassembles fragmented JSON lines and expires stale buffers", () => {
    const f = new JsonLineFramer();
    expect(f.push('{"x":', 1)).toEqual([]);
    expect(f.push('1}\n{"y":2}\n', 2)).toEqual([{ x: 1 }, { y: 2 }]);
    f.push("bad", 3);
    expect(f.push('{"ok":true}\n', 20000)).toEqual([{ ok: true }]);
  });
  it("rejects malformed and out-of-range telemetry", () => {
    const frame = simulate("healthy", identity());
    expect(() =>
      validateFrame({ ...frame, dominant_freq_hz: Infinity }),
    ).toThrow();
    expect(() => validateFrame({ ...frame, mfcc_features: [1, 2] })).toThrow();
    expect(() => validateFrame({ ...frame, wav_base64: "!!!!" })).toThrow();
    expect(() =>
      validateFrame({ ...frame, recorded_at: "2100-01-01" }),
    ).toThrow();
  });
  it.each(["healthy", "swarming", "queenless", "pest_disturbance"] as const)(
    "produces a valid deterministic PCM16 clip for %s",
    (pattern) => {
      const ids = identity();
      const at = new Date();
      const frame = simulate(pattern, ids, 42, at);
      expect(validateFrame(frame)).toMatchObject({
        version: 1,
        duration_seconds: 5,
      });
      const wav = decodeWav(toByteArray(frame.wav_base64!));
      expect(wav.sampleRate).toBe(16000);
      expect(wav.pcm.length).toBe(80000);
      expect(frame.wav_base64).toBe(simulate(pattern, ids, 42, at).wav_base64);
    },
  );
  it("rejects truncated or non-WAV clips", () => {
    expect(() => decodeWav(new Uint8Array(44))).toThrow();
    const frame = simulate("healthy", identity());
    expect(() =>
      decodeWav(toByteArray(frame.wav_base64!).slice(0, 60)),
    ).toThrow();
  });
});

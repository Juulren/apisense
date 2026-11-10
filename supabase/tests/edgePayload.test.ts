import { describe, expect, it } from "vitest";
import {
  base64FromBytes,
  bytesFromBase64,
  crc8,
  decodeEdgePayload,
  edgeClassLabel,
  encodeEdgePayload,
  EdgePayloadError,
} from "../functions/_shared/edgePayload";

const sample = {
  classCode: 1,
  confidence: 0.8,
  temperatureC: 27.35,
  batteryV: 3.9,
  counter: 5,
  flags: 0b0100,
};

describe("edge payload (8 bytes, format 1)", () => {
  it("has the documented CRC-8 (poly 0x07, init 0)", () => {
    // Standard check value for CRC-8/SMBUS over "123456789".
    expect(crc8(new TextEncoder().encode("123456789"))).toBe(0xf4);
    expect(crc8(new Uint8Array([]))).toBe(0);
  });

  it("round-trips a verdict", () => {
    const bytes = encodeEdgePayload(sample);
    expect(bytes).toHaveLength(8);
    expect(bytes[0]).toBe(0x11);
    expect(decodeEdgePayload(bytes)).toEqual({
      formatVersion: 1,
      classMapVersion: 1,
      classCode: 1,
      confidence: 0.8,
      temperatureC: 27.35,
      batteryV: 3.9,
      counter: 5,
      flags: 4,
      sdFull: false,
      micFault: false,
      lowBattery: true,
    });
  });

  it("decodes a fixed byte sequence (contract for the firmware)", () => {
    // 0x11 map1/format1 · class 0 · conf 255 · 25.00 °C (0x09C4) · 3.90 V (0xBE = 190 → 2.00 + 1.90) · counter 3 flags 0
    const body = new Uint8Array([0x11, 0x00, 0xff, 0x09, 0xc4, 0xbe, 0x03]);
    const bytes = new Uint8Array([...body, crc8(body)]);
    expect(decodeEdgePayload(bytes)).toMatchObject({
      classCode: 0,
      confidence: 1,
      temperatureC: 25,
      batteryV: 3.9,
      counter: 3,
      flags: 0,
    });
  });

  it("handles negative temperature, no sensor and unknown battery", () => {
    expect(
      decodeEdgePayload(encodeEdgePayload({ ...sample, temperatureC: -3.5 })).temperatureC,
    ).toBe(-3.5);
    const none = decodeEdgePayload(
      encodeEdgePayload({ ...sample, temperatureC: null, batteryV: null }),
    );
    expect(none.temperatureC).toBeNull();
    expect(none.batteryV).toBeNull();
  });

  it("decodes the three flags independently", () => {
    const f = (flags: number) =>
      decodeEdgePayload(encodeEdgePayload({ ...sample, flags }));
    expect(f(1)).toMatchObject({ sdFull: true, micFault: false, lowBattery: false });
    expect(f(2)).toMatchObject({ sdFull: false, micFault: true, lowBattery: false });
    expect(f(4)).toMatchObject({ sdFull: false, micFault: false, lowBattery: true });
  });

  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      return (error as EdgePayloadError).code;
    }
    return null;
  };
  it("rejects wrong length, a flipped bit, unknown versions and impossible values", () => {
    const good = encodeEdgePayload(sample);
    expect(code(() => decodeEdgePayload(good.subarray(0, 7)))).toBe("length");
    expect(code(() => decodeEdgePayload(new Uint8Array(9)))).toBe("length");
    for (let i = 0; i < 7; i++) {
      const bad = new Uint8Array(good);
      bad[i] = bad[i]! ^ 0x01;
      expect(code(() => decodeEdgePayload(bad))).toBe("crc");
    }
    const reseal = (mutate: (b: Uint8Array) => void) => {
      const b = new Uint8Array(good);
      mutate(b);
      b[7] = crc8(b.subarray(0, 7));
      return b;
    };
    expect(code(() => decodeEdgePayload(reseal((b) => (b[0] = 0x21))))).toBe("format_version");
    expect(code(() => decodeEdgePayload(reseal((b) => (b[0] = 0x10))))).toBe("class_map_version");
    // 120.00 °C
    expect(
      code(() =>
        decodeEdgePayload(
          reseal((b) => {
            b[3] = 0x2e;
            b[4] = 0xe0;
          }),
        ),
      ),
    ).toBe("temperature_range");
  });

  it("labels known codes and never invents a cause for unknown ones", () => {
    expect(edgeClassLabel(1, 0)).toBe("Sonido habitual");
    expect(edgeClassLabel(1, 1)).toBe("Sonido diferente al habitual");
    expect(edgeClassLabel(1, 7)).toContain("sin descripción");
    expect(edgeClassLabel(9, 0)).toContain("mapa v9");
    for (const text of [edgeClassLabel(1, 0), edgeClassLabel(1, 1)])
      expect(text).not.toMatch(/reina|plaga|enjambr/i);
  });

  it("parses TTN base64 strictly", () => {
    const bytes = encodeEdgePayload(sample);
    expect(Array.from(bytesFromBase64(base64FromBytes(bytes)))).toEqual(Array.from(bytes));
    for (const bad of ["", "***", "AAA", "AAAA=A==", "A".repeat(68), "@@@@"])
      expect(code(() => bytesFromBase64(bad))).toBe("base64");
  });
});

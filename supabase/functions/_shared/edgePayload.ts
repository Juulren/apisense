// Uplink sent by the hive node (ESP32 + microphone + classifier) over LoRaWAN.
// The node runs the model; the air only carries this small verdict:
//
//   byte 0  format version (high nibble) | class-map version (low nibble)
//   byte 1  class code (0 = usual sound, 1 = sound different from usual, ...)
//   byte 2  confidence 0..255  -> 0..1
//   byte 3-4 temperature, int16 big-endian, hundredths of °C (0x8000 = no sensor)
//   byte 5  battery: 2.00 V + 10 mV * value (0xFF = unknown)
//   byte 6  counter (low nibble) | flags (high nibble: SD full, mic fault, low battery)
//   byte 7  CRC-8 (polynomial 0x07, initial 0x00) of bytes 0..6
//
// The hive is NOT in the payload: the DevEUI identifies the node and the server
// maps it to a hive. Meaning of the class code depends on the class-map version
// (the firmware and this table are versioned together). This file is shared by
// the app and the Edge Function and has no dependencies.
export const EDGE_FORMAT_VERSION = 1;
export const EDGE_PAYLOAD_BYTES = 8;
export const TEMPERATURE_UNKNOWN = 0x8000;
export const BATTERY_UNKNOWN = 0xff;

/** Never says why a sound is different: that needs an inspection. */
export const edgeClassMaps: Record<number, Record<number, string>> = {
  1: {
    0: "Sonido habitual",
    1: "Sonido diferente al habitual",
  },
};

export type EdgePayloadErrorCode =
  | "length"
  | "format_version"
  | "class_map_version"
  | "crc"
  | "temperature_range"
  | "base64";
export class EdgePayloadError extends Error {
  constructor(
    readonly code: EdgePayloadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EdgePayloadError";
  }
}

export interface EdgeUplink {
  formatVersion: number;
  classMapVersion: number;
  classCode: number;
  /** 0..1 */
  confidence: number;
  temperatureC: number | null;
  batteryV: number | null;
  counter: number;
  /** Raw 4-bit flags. */
  flags: number;
  sdFull: boolean;
  micFault: boolean;
  lowBattery: boolean;
}

export function crc8(bytes: ArrayLike<number>) {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]! & 0xff;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}

export function decodeEdgePayload(bytes: Uint8Array): EdgeUplink {
  if (bytes.length !== EDGE_PAYLOAD_BYTES)
    throw new EdgePayloadError(
      "length",
      `El mensaje debe medir ${EDGE_PAYLOAD_BYTES} bytes`,
    );
  if (crc8(bytes.subarray(0, 7)) !== bytes[7])
    throw new EdgePayloadError("crc", "Suma de verificación incorrecta");
  const formatVersion = bytes[0]! >> 4,
    classMapVersion = bytes[0]! & 0x0f;
  if (formatVersion !== EDGE_FORMAT_VERSION)
    throw new EdgePayloadError(
      "format_version",
      `Formato ${formatVersion} no soportado`,
    );
  if (classMapVersion < 1)
    throw new EdgePayloadError(
      "class_map_version",
      "Versión del mapa de clases inválida",
    );
  const rawTemp = (bytes[3]! << 8) | bytes[4]!;
  let temperatureC: number | null = null;
  if (rawTemp !== TEMPERATURE_UNKNOWN) {
    const signed = rawTemp > 0x7fff ? rawTemp - 0x10000 : rawTemp;
    temperatureC = signed / 100;
    if (temperatureC < -40 || temperatureC > 85)
      throw new EdgePayloadError(
        "temperature_range",
        "Temperatura fuera de rango",
      );
  }
  const flags = bytes[6]! >> 4;
  return {
    formatVersion,
    classMapVersion,
    classCode: bytes[1]!,
    confidence: Math.round((bytes[2]! / 255) * 1000) / 1000,
    temperatureC,
    batteryV:
      bytes[5] === BATTERY_UNKNOWN
        ? null
        : Math.round((2 + bytes[5]! * 0.01) * 100) / 100,
    counter: bytes[6]! & 0x0f,
    flags,
    sdFull: (flags & 1) !== 0,
    micFault: (flags & 2) !== 0,
    lowBattery: (flags & 4) !== 0,
  };
}

/** Encodes a verdict (used by tests and by the demo simulator). */
export function encodeEdgePayload(input: {
  classMapVersion?: number;
  classCode: number;
  confidence: number;
  temperatureC: number | null;
  batteryV: number | null;
  counter?: number;
  flags?: number;
}) {
  const bytes = new Uint8Array(EDGE_PAYLOAD_BYTES);
  bytes[0] = (EDGE_FORMAT_VERSION << 4) | ((input.classMapVersion ?? 1) & 0x0f);
  bytes[1] = input.classCode & 0xff;
  bytes[2] = Math.max(0, Math.min(255, Math.round(input.confidence * 255)));
  const temp =
    input.temperatureC === null
      ? TEMPERATURE_UNKNOWN
      : Math.round(input.temperatureC * 100) & 0xffff;
  bytes[3] = temp >> 8;
  bytes[4] = temp & 0xff;
  bytes[5] =
    input.batteryV === null
      ? BATTERY_UNKNOWN
      : Math.max(0, Math.min(254, Math.round((input.batteryV - 2) * 100)));
  bytes[6] = (((input.flags ?? 0) & 0x0f) << 4) | ((input.counter ?? 0) & 0x0f);
  bytes[7] = crc8(bytes.subarray(0, 7));
  return bytes;
}

/** Strict base64 (as TTN delivers `frm_payload`). */
export function bytesFromBase64(value: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 64 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value) ||
    value.length % 4 !== 0
  )
    throw new EdgePayloadError("base64", "Carga útil base64 inválida");
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
export function base64FromBytes(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function edgeClassLabel(mapVersion: number, code: number) {
  return (
    edgeClassMaps[mapVersion]?.[code] ??
    `Código ${code} (mapa v${mapVersion}, sin descripción en esta versión)`
  );
}

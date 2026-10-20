export interface TelemetryFrame {
  version: 1; id: string; hive_id: string; device_id: string; recorded_at: string;
  duration_seconds: number; sampling_rate_hz: number; dominant_freq_hz: number; amplitude_db: number;
  mfcc_features: number[]; battery_level: number; wav_base64?: string;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateFrame(input: unknown, now = Date.now()): TelemetryFrame {
  if (!input || typeof input !== 'object') throw new Error('Paquete de telemetría inválido');
  const f = input as Partial<TelemetryFrame>;
  const finite = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (f.version !== 1 || !uuid.test(f.id ?? '') || !uuid.test(f.hive_id ?? '') || !uuid.test(f.device_id ?? '')) throw new Error('Versión o identificadores inválidos');
  if (typeof f.recorded_at !== 'string' || !Number.isFinite(Date.parse(f.recorded_at)) || Date.parse(f.recorded_at) > now+300_000) throw new Error('Fecha de captura inválida');
  if (!finite(f.duration_seconds,.01,30) || !finite(f.sampling_rate_hz,1000,96000) || !Number.isInteger(f.sampling_rate_hz) || !finite(f.dominant_freq_hz,0,(f.sampling_rate_hz ?? 0)/2) || !finite(f.amplitude_db,-160,0) || !finite(f.battery_level,0,100)) throw new Error('Lecturas fuera de rango');
  if (!Array.isArray(f.mfcc_features) || f.mfcc_features.length !== 13 || !f.mfcc_features.every(v => finite(v,-10000,10000))) throw new Error('Se requieren 13 coeficientes MFCC finitos');
  if (f.wav_base64 !== undefined && (typeof f.wav_base64 !== 'string' || f.wav_base64.length > 1_400_000 || f.wav_base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(f.wav_base64))) throw new Error('Clip base64 inválido o demasiado grande');
  return { ...f, recorded_at:new Date(f.recorded_at).toISOString() } as TelemetryFrame;
}
export class JsonLineFramer {
  private buffer = ''; private lastAt = 0;
  push(chunk: string, now = Date.now()): unknown[] {
    if (now-this.lastAt > 10_000) this.buffer=''; this.lastAt=now;
    this.buffer += chunk;
    if (this.buffer.length > 1_500_000) { this.buffer=''; throw new Error('Trama BLE demasiado grande'); }
    const lines=this.buffer.split('\n'); this.buffer=lines.pop() ?? '';
    return lines.filter(line=>line.trim()).map(line=>JSON.parse(line) as unknown);
  }
}

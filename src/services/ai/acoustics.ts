export interface AcousticFeatures {
  dominantHz: number;
  amplitudeDb: number;
  mfcc: number[];
  spectrum: number[];
  flatness: number;
  zeroCrossingRate: number;
}
export function powerSpectrum(pcm: Float32Array): number[] {
  const n = pcm.length;
  if (n < 2 || n & (n - 1))
    throw new Error("FFT requiere longitud potencia de dos");
  const re = new Float64Array(n),
    im = new Float64Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    if (i) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
    }
    re[j] = (pcm[i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const a = start + k,
          b = a + half,
          angle = (-2 * Math.PI * k) / size,
          c = Math.cos(angle),
          s = Math.sin(angle);
        const real = (re[b] ?? 0) * c - (im[b] ?? 0) * s,
          imag = (re[b] ?? 0) * s + (im[b] ?? 0) * c;
        re[b] = (re[a] ?? 0) - real;
        im[b] = (im[a] ?? 0) - imag;
        re[a] = (re[a] ?? 0) + real;
        im[a] = (im[a] ?? 0) + imag;
      }
    }
  }
  return Array.from(
    { length: n / 2 + 1 },
    (_, i) => ((re[i] ?? 0) ** 2 + (im[i] ?? 0) ** 2) / (n * n),
  );
}
export function melCepstrum(
  spectrum: number[],
  sampleRate: number,
  nfft: number,
): number[] {
  const mel = (hz: number) => 2595 * Math.log10(1 + hz / 700),
    hz = (m: number) => 700 * (10 ** (m / 2595) - 1),
    bands = 26;
  const bins = Array.from({ length: bands + 2 }, (_, i) =>
    Math.floor(
      ((nfft + 1) * hz((mel(sampleRate / 2) * i) / (bands + 1))) / sampleRate,
    ),
  );
  const energy = Array.from({ length: bands }, (_, i) => {
    const left = bins[i] ?? 0,
      mid = bins[i + 1] ?? 0,
      right = bins[i + 2] ?? 0;
    let sum = 0;
    for (let k = left; k < right; k++) {
      const weight =
        k < mid
          ? (k - left) / Math.max(1, mid - left)
          : (right - k) / Math.max(1, right - mid);
      sum += (spectrum[k] ?? 0) * weight;
    }
    return Math.log(Math.max(1e-12, sum));
  });
  return Array.from(
    { length: 13 },
    (_, c) =>
      energy.reduce(
        (sum, value, i) =>
          sum + value * Math.cos((Math.PI * c * (i + 0.5)) / bands),
        0,
      ) * Math.sqrt((c === 0 ? 1 : 2) / bands),
  );
}
export function preprocess(
  pcm: Float32Array,
  sampleRate: number,
): AcousticFeatures {
  if (
    !pcm.length ||
    sampleRate < 1000 ||
    sampleRate > 96000 ||
    !Number.isInteger(sampleRate) ||
    pcm.some((v) => !Number.isFinite(v))
  )
    throw new Error("PCM o muestreo inválido");
  const nfft = 2048,
    available = Math.max(1, Math.floor((pcm.length - nfft) / 1024) + 1),
    count = Math.min(64, available);
  const spectrum = new Array<number>(nfft / 2 + 1).fill(0),
    mfcc = new Array<number>(13).fill(0);
  for (let frame = 0; frame < count; frame++) {
    const offset =
      count === 1
        ? 0
        : Math.floor((frame * Math.max(0, pcm.length - nfft)) / (count - 1));
    const window = new Float32Array(nfft);
    window.set(pcm.subarray(offset, offset + nfft));
    const power = powerSpectrum(window),
      coeff = melCepstrum(power, sampleRate, nfft);
    power.forEach((v, i) => {
      spectrum[i] = (spectrum[i] ?? 0) + v / count;
    });
    coeff.forEach((v, i) => {
      mfcc[i] = (mfcc[i] ?? 0) + v / count;
    });
  }
  let energy = 0,
    crossings = 0;
  pcm.forEach((v, i) => {
    energy += v * v;
    if (i > 0 && v >= 0 !== (pcm[i - 1] ?? 0) >= 0) crossings++;
  });
  let peak = 1;
  for (let i = 2; i < spectrum.length; i++)
    if ((spectrum[i] ?? 0) > (spectrum[peak] ?? 0)) peak = i;
  const values = spectrum.slice(1),
    arithmetic = values.reduce((s, v) => s + v, 0) / values.length,
    geometric = Math.exp(
      values.reduce((s, v) => s + Math.log(Math.max(v, 1e-14)), 0) /
        values.length,
    );
  return {
    dominantHz: (peak * sampleRate) / nfft,
    amplitudeDb:
      20 * Math.log10(Math.max(1e-8, Math.sqrt(energy / pcm.length))),
    mfcc,
    spectrum,
    flatness: arithmetic > 0 ? Math.min(1, geometric / arithmetic) : 0,
    zeroCrossingRate: crossings / pcm.length,
  };
}

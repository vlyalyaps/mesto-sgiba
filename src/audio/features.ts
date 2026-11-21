import type { SongFeatures } from '../types/dayspec';

/** Чистая часть разбора звука: только числа, без Web Audio и сети. */

const WINDOW_SEC = 0.05;
const SMOOTH_SEC = 1;
const MIN_BPM = 70;
const MAX_BPM = 180;
const DB_QUIET = -40;
const DB_LOUD = -6;
const DB_FLOOR = -60;
const SPREAD_FULL_DB = 24;

export interface Tempo {
  bpm: number;
  /** Секунда первой сильной доли. */
  offset: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Среднее по каналам: из AudioBuffer получаем моно-сэмплы. */
export function toMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0]?.length ?? 0);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}

/** RMS окнами по 50 мс (последнее неполное окно отбрасываем). */
export function rmsWindows(samples: ArrayLike<number>, sampleRate: number): number[] {
  const win = Math.max(1, Math.round(sampleRate * WINDOW_SEC));
  const out: number[] = [];
  for (let s = 0; s + win <= samples.length; s += win) {
    let sum = 0;
    for (let i = s; i < s + win; i++) sum += samples[i] * samples[i];
    out.push(Math.sqrt(sum / win));
  }
  return out;
}

const toDb = (rms: number) => (rms > 0 ? 20 * Math.log10(rms) : -Infinity);

/** Громкость фрагмента 0..1: общий RMS в dBFS, −40 дБ → 0, −6 дБ → 1. */
export function energyOf(rms: number[]): number {
  if (rms.length === 0) return 0;
  const meanSq = rms.reduce((a, r) => a + r * r, 0) / rms.length;
  return clamp01((toDb(Math.sqrt(meanSq)) - DB_QUIET) / (DB_LOUD - DB_QUIET));
}

/** Разброс громкости 0..1: расстояние между 10-м и 90-м процентилем громкости окон, 24 дБ → 1. */
export function energySpreadOf(rms: number[]): number {
  if (rms.length < 2) return 0;
  const db = rms.map((r) => Math.max(DB_FLOOR, toDb(r))).sort((a, b) => a - b);
  const at = (p: number) => db[Math.min(db.length - 1, Math.floor(p * (db.length - 1)))];
  return clamp01((at(0.9) - at(0.1)) / SPREAD_FULL_DB);
}

/**
 * Секунда пика: максимум RMS, сглаженного скользящим средним за ~1 с, без первой и последней
 * секунды (там затухание и вступление). Возвращает середину окна сглаживания.
 */
export function peakSecOf(all: number[]): number {
  if (all.length === 0) return 0;
  const k = Math.max(1, Math.round(SMOOTH_SEC / WINDOW_SEC));
  const edge = Math.round(1 / WINDOW_SEC);
  // Первую и последнюю секунду выкидываем из сигнала целиком, чтобы они не подтекали в сглаживание.
  // У слишком короткого фрагмента берём всё.
  const trimmed = all.length > 2 * edge + k;
  const from = trimmed ? edge : 0;
  const rms = trimmed ? all.slice(edge, all.length - edge) : all;
  const n = rms.length;
  const half = Math.floor(k / 2);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + rms[i];

  let best = -1;
  let bestIdx = 0;
  for (let c = 0; c < n; c++) {
    const a = Math.max(0, c - half);
    const b = Math.min(n, c - half + k);
    const mean = (prefix[b] - prefix[a]) / (b - a);
    if (mean > best + 1e-12) {
      best = mean;
      bestIdx = c;
    }
  }
  return Math.round((from + bestIdx + 0.5) * WINDOW_SEC * 1000) / 1000;
}

/**
 * Запасной темп по автокорреляции огибающей: огибающая громкости с шагом 5 мс → положительный
 * прирост → автокорреляция в диапазоне 70–180 уд/мин → фаза сильной доли.
 */
export function estimateTempo(samples: ArrayLike<number>, sampleRate: number): Tempo {
  const hop = Math.max(1, Math.round(sampleRate * 0.005));
  const frameSec = hop / sampleRate;
  const frames = Math.floor(samples.length / hop);
  const fallback: Tempo = { bpm: 100, offset: 0 };
  if (frames < 100) return fallback;

  const env = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) sum += samples[i] * samples[i];
    env[f] = Math.sqrt(sum / hop);
  }
  const flux = new Float64Array(frames);
  let mean = 0;
  for (let f = 1; f < frames; f++) {
    flux[f] = Math.max(0, env[f] - env[f - 1]);
    mean += flux[f] / frames;
  }
  let energy = 0;
  for (let f = 0; f < frames; f++) {
    flux[f] -= mean;
    energy += flux[f] * flux[f];
  }
  if (energy < 1e-12) return fallback;

  const minLag = Math.floor(60 / MAX_BPM / frameSec);
  const maxLag = Math.min(frames - 2, Math.ceil(60 / MIN_BPM / frameSec));
  if (maxLag <= minLag + 2) return fallback;
  const acf = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let sum = 0;
    for (let f = 0; f + lag < frames; f++) sum += flux[f] * flux[f + lag];
    acf[lag] = sum / (frames - lag);
  }
  let bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) if (acf[lag] > acf[bestLag]) bestLag = lag;

  // Параболическое уточнение пика: темп точнее шага сетки.
  const a = acf[bestLag - 1];
  const b = acf[bestLag];
  const c = acf[bestLag + 1];
  const denom = a - 2 * b + c;
  const shift = denom < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom)) : 0;
  const period = (bestLag + shift) * frameSec;
  const bpm = Math.round((60 / period) * 10) / 10;

  // Фаза: на какой сдвиг внутри периода приходится больше всего прироста громкости.
  const periodFrames = period / frameSec;
  const bins = Math.max(1, Math.round(periodFrames));
  const phase = new Float64Array(bins);
  for (let f = 0; f < frames; f++) {
    if (flux[f] <= 0) continue;
    phase[Math.floor(((f % periodFrames) / periodFrames) * bins) % bins] += flux[f];
  }
  let bestPhase = 0;
  for (let i = 1; i < bins; i++) if (phase[i] > phase[bestPhase]) bestPhase = i;
  return { bpm, offset: Math.round(((bestPhase + 0.5) / bins) * period * 1000) / 1000 };
}

/** Сильные доли: offset + k·60/bpm до конца фрагмента, секунды с точностью до мс. */
export function beatGrid(tempo: Tempo, durationSec: number): number[] {
  const { bpm } = tempo;
  if (!(bpm > 0) || !Number.isFinite(bpm)) return [];
  const step = 60 / bpm;
  let t = tempo.offset % step;
  if (t < 0) t += step;
  const beats: number[] = [];
  for (; t < durationSec && beats.length < 2000; t += step) beats.push(Math.round(t * 1000) / 1000);
  return beats;
}

/**
 * Все признаки фрагмента по моно-сэмплам. tempo — готовый темп от детектора; без него
 * считаем запасным способом (автокорреляция).
 */
export function features(
  samples: ArrayLike<number>,
  sampleRate: number,
  tempo?: Tempo,
): SongFeatures {
  const rms = rmsWindows(samples, sampleRate);
  const t = tempo ?? estimateTempo(samples, sampleRate);
  return {
    bpm: t.bpm,
    energy: Math.round(energyOf(rms) * 1000) / 1000,
    energySpread: Math.round(energySpreadOf(rms) * 1000) / 1000,
    peakSec: peakSecOf(rms),
    beats: beatGrid(t, samples.length / sampleRate),
    measured: true,
  };
}

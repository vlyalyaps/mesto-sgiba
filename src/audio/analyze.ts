import { guess } from 'web-audio-beat-detector';
import type { SongFeatures } from '../types/dayspec';
import { estimateTempo, features, toMono, type Tempo } from './features';

/** Чистая часть разбора звука живёт в features.ts; здесь — для удобства. */
export { features } from './features';

const DECODE_RATE = 44100;

/**
 * Разбор официального фрагмента в браузере: fetch → decodeAudioData → громкость по окнам
 * (energy, energySpread, peakSec, beats) и темп через web-audio-beat-detector.
 * Звук нигде не сохраняется. Владелец — направление «ввод и звук».
 */
export async function analyzePreview(url: string, signal?: AbortSignal): Promise<SongFeatures> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Фрагмент песни не загрузился.');
  const bytes = await res.arrayBuffer();
  signal?.throwIfAborted();

  // Офлайн-контекст декодирует без жеста человека и сразу в 44,1 кГц.
  const ctx = new OfflineAudioContext(1, 1, DECODE_RATE);
  const audio = await ctx.decodeAudioData(bytes);
  signal?.throwIfAborted();

  const channels: Float32Array[] = [];
  for (let c = 0; c < audio.numberOfChannels; c++) channels.push(audio.getChannelData(c));
  const samples = toMono(channels);

  let tempo: Tempo | undefined;
  try {
    const g = await guess(audio);
    if (Number.isFinite(g.bpm) && g.bpm >= 40 && g.bpm <= 240 && Number.isFinite(g.offset)) {
      tempo = { bpm: Math.round(g.bpm * 10) / 10, offset: g.offset };
    }
  } catch {
    tempo = undefined;
  }
  signal?.throwIfAborted();

  return features(samples, audio.sampleRate, tempo ?? estimateTempo(samples, audio.sampleRate));
}

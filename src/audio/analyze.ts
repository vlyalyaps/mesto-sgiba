import type { SongFeatures } from '../types/dayspec';

/**
 * Разбор официального фрагмента в браузере: fetch → decodeAudioData → громкость по окнам
 * (energy, energySpread, peakSec, beats) и темп через web-audio-beat-detector.
 * Звук нигде не сохраняется. Владелец — направление «ввод и звук».
 */
export async function analyzePreview(url: string, signal?: AbortSignal): Promise<SongFeatures> {
  void url;
  void signal;
  throw new Error('analyzePreview: ещё не сделано');
}

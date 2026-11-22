/**
 * Правила музыки: темп → ритм складок и длительность раскрытия, энергия → густота полос и зерно,
 * пик громкости → момент раскрытия. Без песни — нейтральные значения.
 */
import type { Rhythm, Reveal, SongFeatures, SongInput, WhyLine } from '../types/dayspec';
import { beatsPhrase, clamp, fmt, round } from './util';

/** Быстрой считаем песню от этого темпа: складка на 4 доли, иначе на 8. */
export const FAST_BPM = 110;
const MIN_REVEAL_MS = 1200;
const MAX_REVEAL_MS = 4000;
const NEUTRAL_REVEAL_MS = 2400;
/** Звук стартует за 2,5 с до пика: страница собирается быстро и закрывается ровно на пике. */
const PREROLL_SEC = 2.5;
const FRAGMENT_SEC = 30;

export interface MusicRules {
  rhythm: Rhythm;
  reveal: Reveal;
  grain: number;
  why: WhyLine[];
}

const NEUTRAL = { beatsPerFold: 8 as const, density: 0.4, grain: 0.3 };

export function musicRules(song: SongInput | null): MusicRules {
  const f = song?.features ?? null;
  const why: WhyLine[] = [];

  if (!f) {
    why.push({
      param: 'reveal.peakSec',
      text: song
        ? 'У песни нет признаков звука: ритм и зерно нейтральные, момент пика не задан, раскрытие идёт без привязки к песне'
        : 'Песни нет: ритм и зерно нейтральные, момента пика нет, раскрытие идёт без привязки к песне',
    });
    return {
      rhythm: { beatsPerFold: NEUTRAL.beatsPerFold, density: NEUTRAL.density },
      reveal: { durationMs: NEUTRAL_REVEAL_MS, peakSec: null, prerollSec: PREROLL_SEC, beats: [] },
      grain: NEUTRAL.grain,
      why,
    };
  }

  const bpm = Number.isFinite(f.bpm) && f.bpm > 0 ? f.bpm : null;
  const energy = clamp(finite(f.energy, 0.4), 0, 1);
  const spread = clamp(finite(f.energySpread, 0.2), 0, 1);

  // темп → складка на 4 или 8 долей
  const beatsPerFold: 4 | 8 = bpm !== null && bpm >= FAST_BPM ? 4 : 8;
  if (bpm !== null) {
    why.push({
      param: 'rhythm.beatsPerFold',
      text:
        beatsPerFold === 4
          ? `Складки тесные: песня быстрая, ${beatsPhrase(bpm)}`
          : `Складки просторные: песня ${bpm < 90 ? 'неспешная' : 'ровная'}, ${beatsPhrase(bpm)}`,
    });
  }

  // энергия → густота полос и зерно
  const density = clamp(0.2 + 0.55 * energy + 0.25 * spread, 0, 1);
  const grain = clamp(0.1 + 0.6 * energy + 0.3 * spread, 0, 1);
  const level = energy >= 0.65 ? 'high' : energy <= 0.4 ? 'low' : 'mid';
  const song_ = { high: 'плотная и громкая', mid: 'средней громкости', low: 'тихая' }[level];
  why.push({
    param: 'rhythm.density',
    text: `Полосы ${{ high: 'густые', mid: 'средней густоты', low: 'редкие' }[level]}: песня ${song_}, энергия ${fmt(energy, 2)} из 1`,
  });
  why.push({
    param: 'paper.grain',
    text: `Зерно ${{ high: 'сильное', mid: 'среднее', low: 'слабое' }[level]}: песня ${song_}`,
  });

  // раскрытие: длительность в долях песни, момент — по пику громкости
  const durationMs =
    bpm !== null
      ? Math.round(clamp((beatsPerFold * 60000) / bpm, MIN_REVEAL_MS, MAX_REVEAL_MS))
      : NEUTRAL_REVEAL_MS;
  const peakSec = Number.isFinite(f.peakSec) ? clamp(f.peakSec, 0, FRAGMENT_SEC) : null;
  const prerollSec = peakSec === null ? PREROLL_SEC : Math.min(PREROLL_SEC, peakSec);

  if (bpm !== null) {
    why.push({
      param: 'reveal.durationMs',
      text: `Разворот раскрывается ${fmt(durationMs / 1000)} с: столько длятся ${beatsPerFold === 4 ? '4 доли' : '8 долей'} песни`,
    });
  }
  if (peakSec !== null) {
    why.push({
      param: 'reveal.peakSec',
      text: `Разворот раскрыт полностью на ${Math.round(peakSec)}-й секунде фрагмента: там пик громкости, звук стартует за ${fmt(prerollSec, prerollSec % 1 === 0 ? 0 : 1)} с до него`,
    });
  }

  return {
    rhythm: { beatsPerFold, density: round(density) },
    reveal: { durationMs, peakSec, prerollSec: round(prerollSec), beats: beatsOf(f, bpm) },
    grain: round(grain),
    why,
  };
}

function finite(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback;
}

/** Сильные доли из признаков; нет — ровная сетка по темпу. */
function beatsOf(f: SongFeatures, bpm: number | null): number[] {
  if (f.beats?.length) {
    return f.beats
      .filter((b) => Number.isFinite(b) && b >= 0 && b <= FRAGMENT_SEC)
      .sort((a, b) => a - b);
  }
  if (bpm === null) return [];
  const step = 60 / bpm;
  const out: number[] = [];
  for (let t = 0; t <= FRAGMENT_SEC; t += step) out.push(round(t));
  return out;
}

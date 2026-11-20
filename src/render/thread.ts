import type { DaySpec } from '../types/dayspec';
import type { PanelPlan } from './geometry';

export interface Thread {
  /** Где начинается каждый лист, если разложить книжку плоско; в долях высоты H. */
  starts: number[];
  /** Сгиб между половинами разворота: здесь стоит пик песни. */
  gutter: number;
  /** Сколько долей H занимает секунда фрагмента. */
  perSec: number;
  peakSec: number;
  ticks: { x: number; down: boolean }[];
}

/**
 * Нить песни: доли фрагмента лежат вдоль всех листов. Доли, которые раскрывают складки,
 * приходятся на сами складки, а пик — ровно на сгиб разворота. Пока книжка сложена,
 * нить разорвана; раскрытая — сходится в одну строку.
 */
export function songThread(plan: PanelPlan[], spec: DaySpec, windowSec: number): Thread | null {
  const peak = spec.reveal.peakSec;
  const beats = [...spec.reveal.beats].sort((a, b) => a - b);
  const right = plan.findIndex((q) => q.side === 'R');
  if (peak === null || beats.length < 2 || right < 0) return null;

  const starts: number[] = [];
  let x = 0;
  for (const q of plan) {
    starts.push(x);
    x += q.w;
  }
  const gutter = starts[right];
  // Складки до разворота вмещают окно раскрытия; без складок — шаг как у половины разворота.
  const firstLeaf = plan.length > 1 ? starts[1] : 0;
  const span = Math.max(gutter - firstLeaf, plan[right].w);
  const perSec = span / Math.max(0.5, windowSec);

  let near = 0;
  beats.forEach((b, i) => {
    if (Math.abs(b - peak) < Math.abs(beats[near] - peak)) near = i;
  });
  const every = spec.rhythm.beatsPerFold;
  const ticks = beats
    .map((b, i) => ({
      x: gutter + (b - peak) * perSec,
      down: (((i - near) % every) + every) % every === 0,
    }))
    .filter((t) => t.x > firstLeaf && t.x < x);
  return { starts, gutter, perSec, peakSec: peak, ticks };
}

/**
 * Слова, которые сделали книжку: строки «Почему так» цитируют их в кавычках.
 * Слово → короткая пометка о том, что оно изменило («поля шире»).
 */
export function causeMarks(why: DaySpec['why']): Map<string, string> {
  const marks = new Map<string, string>();
  for (const w of why) {
    if (w.param === 'folderName' || w.param.startsWith('rhythm') || w.param.startsWith('reveal'))
      continue;
    const note = w.text.split(':')[0].trim();
    for (const m of w.text.matchAll(/«([^»]+)»/g)) {
      const word = m[1].toLowerCase();
      if (/\d/.test(word) || word.split(' ').length > 3 || note.includes(`«${m[1]}»`)) continue;
      if (!marks.has(word)) marks.set(word, note[0].toLowerCase() + note.slice(1));
    }
  }
  return marks;
}

export interface Segment {
  text: string;
  note?: string;
}

/** Делит фразу на куски и помечает слова-причины; регистр и форма слова сохраняются. */
export function markText(text: string, marks: Map<string, string>): Segment[] {
  if (!marks.size) return [{ text }];
  const words = [...marks.keys()].sort((a, b) => b.length - a.length).map(escape);
  const re = new RegExp(`(?<![а-яёa-z])(${words.join('|')})(?![а-яёa-z])`, 'gi');
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i) });
    out.push({ text: m[0], note: marks.get(m[0].toLowerCase()) });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

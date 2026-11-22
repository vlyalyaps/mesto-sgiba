import type { DaySpec } from '../types/dayspec';

/** Сборка без звука: вся страница за полторы секунды с небольшим. */
export const SILENT_SEC = 1.6;
/** Доля окна до пика, за которую ложатся детали: главный кадр ждёт сам пик. */
const DETAILS_SHARE = 0.75;

/**
 * С какой секунды фрагмента звучит песня: за `prerollSec` до пика (по правилам — 4 с),
 * чтобы страница собралась быстро и закончилась ровно на пике.
 */
export function assemblyStart(spec: DaySpec) {
  const { peakSec, prerollSec } = spec.reveal;
  return peakSec === null ? 0 : Math.max(0, peakSec - prerollSec);
}

/**
 * Секунды фрагмента, на которых появляются элементы страницы. Порядок задают правила
 * (доля каждого элемента), а сами появления сжаты в окно перед пиком и прилипают к долям
 * в этом окне. Главный кадр — на пике, скотч и образцы бумаги — сразу после своего отпечатка.
 */
export function assemblyTimes(spec: DaySpec) {
  const { beats, peakSec } = spec.reveal;
  const elements = spec.page.elements;
  const length = elements.length;
  const key = spec.photos.find((p) => p.role === 'key')?.photoId;
  const start = assemblyStart(spec);
  const end = peakSec ?? Math.max(beats.at(-1) ?? 0, 3.5);
  const isHero = (i: number) => {
    const e = elements[i];
    return e.kind === 'photo' && e.photoId === key && peakSec !== null;
  };

  // Порядок появления по правилам: доля элемента или его место в списке.
  const order = elements.map((e, i) => beats[e.beat] ?? (end * i) / Math.max(1, length - 1));
  const ranked = elements.map((_, i) => i).filter((i) => !isHero(i));
  ranked.sort((a, b) => order[a] - order[b] || a - b);

  const span = Math.max(0.6, (end - start) * DETAILS_SHARE);
  const near = beats.filter((b) => b >= start && b <= start + span);
  const snap = (t: number) =>
    near.length ? near.reduce((best, b) => (Math.abs(b - t) < Math.abs(best - t) ? b : best)) : t;

  const times = new Array<number>(length).fill(start);
  ranked.forEach((i, r) => {
    times[i] = snap(start + (span * r) / Math.max(1, ranked.length - 1));
  });
  elements.forEach((_, i) => {
    if (isHero(i)) times[i] = peakSec!;
  });

  const photos = new Map<string, number>();
  elements.forEach((e, i) => {
    if (e.kind === 'photo') photos.set(e.photoId, times[i]);
  });
  const after = (print: number) => beats.find((b) => b > print && b <= print + 0.6) ?? print + 0.2;
  elements.forEach((e, i) => {
    if (e.kind === 'sticker' && e.motif === 'paper-swatches' && key !== undefined) {
      times[i] = after(photos.get(key) ?? start);
    }
    if (e.kind !== 'tape') return;
    const print = photos.get(e.photoId) ?? start;
    if (times[i] < print) times[i] = after(print);
  });
  return times;
}

/** Без звука тот же порядок, но вся страница складывается за SILENT_SEC. */
export function silentTimes(times: number[]) {
  const min = Math.min(...times);
  const range = Math.max(...times) - min;
  return times.map((t) => (range > 0 ? ((t - min) / range) * SILENT_SEC : 0));
}

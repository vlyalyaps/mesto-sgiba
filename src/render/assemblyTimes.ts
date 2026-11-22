import type { DaySpec } from '../types/dayspec';

export function assemblyTimes(spec: DaySpec) {
  const { beats, peakSec } = spec.reveal;
  const length = spec.page.elements.length;
  const end = Math.max(peakSec ?? 0, beats.at(-1) ?? 0, 3.5);
  const key = spec.photos.find((p) => p.role === 'key')?.photoId;
  const times = spec.page.elements.map((e, i) =>
    e.kind === 'photo' && e.photoId === key && peakSec !== null
      ? peakSec
      : (beats[e.beat] ?? (end * i) / Math.max(1, length - 1)),
  );
  const photos = new Map<string, number>();
  spec.page.elements.forEach((e, i) => {
    if (e.kind === 'photo') photos.set(e.photoId, times[i]);
  });
  spec.page.elements.forEach((e, i) => {
    if (e.kind === 'sticker' && e.motif === 'paper-swatches' && key !== undefined) {
      const print = photos.get(key) ?? 0;
      times[i] = beats.find((b) => b > print) ?? Math.min(end, print + 0.28);
    }
    if (e.kind !== 'tape') return;
    const print = photos.get(e.photoId) ?? 0;
    if (times[i] < print) times[i] = beats.find((b) => b > print) ?? print;
  });
  return times;
}
export function silentTimes(times: number[]) {
  const factor = 3.5 / Math.max(1, ...times);
  return times.map((t) => t * factor);
}

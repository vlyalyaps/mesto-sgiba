import { expect, it } from 'vitest';
import { fixtures } from '../fixtures';
import { buildDaySpec } from '../rules';
import { assemblyTimes, silentTimes } from './assemblyTimes';
it('пик между долями, лента после отпечатка, беззвучная сборка за 3,5 с', () => {
  const spec = buildDaySpec(fixtures[0].input);
  spec.reveal.peakSec = 20.137;
  const times = assemblyTimes(spec);
  const key = spec.photos.find((p) => p.role === 'key')!.photoId;
  const i = spec.page.elements.findIndex((e) => e.kind === 'photo' && e.photoId === key);
  expect(times[i]).toBe(20.137);
  expect(
    times
      .filter((_, j) => {
        const e = spec.page.elements[j];
        return e.kind === 'tape' && e.photoId === key;
      })
      .every((t) => t >= times[i]),
  ).toBe(true);
  const swatch = spec.page.elements.findIndex(
    (e) => e.kind === 'sticker' && e.motif === 'paper-swatches',
  );
  expect(times[swatch]).toBe(spec.reveal.beats.find((beat) => beat > times[i]));
  expect(Math.max(...silentTimes(times))).toBeCloseTo(3.5);
});
it('собирает старую запись без песни и списка долей', () => {
  const spec = buildDaySpec({ ...fixtures[0].input, song: null });
  const times = silentTimes(assemblyTimes(spec));
  expect(Math.max(...times)).toBeCloseTo(3.5);
  expect(times.every(Number.isFinite)).toBe(true);
});

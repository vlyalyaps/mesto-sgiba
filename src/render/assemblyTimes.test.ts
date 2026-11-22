import { expect, it } from 'vitest';
import { fixtures } from '../fixtures';
import { buildDaySpec } from '../rules';
import { assemblyStart, assemblyTimes, SILENT_SEC, silentTimes } from './assemblyTimes';
it('пик между долями, лента после отпечатка, детали до пика, беззвучная сборка быстрая', () => {
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
  // Звук стартует за 4 с до пика, все детали ложатся в это окно.
  expect(assemblyStart(spec)).toBeCloseTo(20.137 - spec.reveal.prerollSec);
  expect(times.every((t) => t >= assemblyStart(spec) && t <= 20.137 + 0.6)).toBe(true);
  expect(Math.max(...silentTimes(times))).toBeCloseTo(SILENT_SEC);
});
it('собирает старую запись без песни и списка долей', () => {
  const spec = buildDaySpec({ ...fixtures[0].input, song: null });
  const times = silentTimes(assemblyTimes(spec));
  expect(Math.max(...times)).toBeCloseTo(SILENT_SEC);
  expect(times.every(Number.isFinite)).toBe(true);
});

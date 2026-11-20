import { describe, it, expect } from 'vitest';
import { fixtures } from '../fixtures';
import { buildDaySpec } from './index';
import { footprint, intersects } from './page';
const [a, b, c, d] = fixtures.map((f) => f.input);
const stickers = (input: typeof a) =>
  buildDaySpec(input).page.elements.filter((e) => e.kind === 'sticker');
describe('листы скетчбука', () => {
  it('один день воспроизводится после JSON round trip', () => {
    for (const { input } of fixtures)
      expect(buildDaySpec(JSON.parse(JSON.stringify(input))).page).toEqual(
        buildDaySpec(input).page,
      );
  });
  it('одни фото, песня и семя — разные рисунки и раскладка по рассказу', () => {
    const pair = { ...a, text: b.text };
    expect(stickers(pair).map((e) => e.motif)).not.toEqual(stickers(a).map((e) => e.motif));
    expect(buildDaySpec(a).page.elements.filter((e) => e.kind === 'photo')).not.toEqual(
      buildDaySpec(pair).page.elements.filter((e) => e.kind === 'photo'),
    );
  });
  it('одна замена песни меняет плотность и ритм', () => {
    const slow = { ...a, song: c.song };
    expect(stickers(slow).length).toBeLessThan(stickers(a).length);
    expect(buildDaySpec(slow).reveal.beats).not.toEqual(buildDaySpec(a).reveal.beats);
    expect(stickers(c).length).toBeLessThanOrEqual(3);
    expect(stickers(a).length).toBeGreaterThanOrEqual(7);
    expect(buildDaySpec(d).page.stock).toBe('aged');
  });
  it('рисунки свободны от всех других элементов с учётом поворота', () => {
    for (const { input } of fixtures) {
      const { elements } = buildDaySpec(input).page;
      for (const e of elements.filter((e) => e.kind === 'sticker')) {
        expect(
          elements.filter(
            (other) =>
              other !== e && other.leaf === e.leaf && intersects(footprint(e), footprint(other)),
          ),
        ).toEqual([]);
      }
    }
  });
  it('настроение оставляет краску и материал бумаги прежними', () => {
    const p = buildDaySpec(a).page;
    const changed = buildDaySpec({ ...a, mood: 'tired' }).page;
    expect(changed.stock).toBe(p.stock);
    expect(changed.marker).toBe(p.marker);
  });
});

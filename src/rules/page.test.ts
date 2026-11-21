import { describe, it, expect } from 'vitest';
import { fixtures } from '../fixtures';
import { buildDaySpec } from './index';
import type { DaySpec } from '../types/dayspec';

const [a, b, c, d] = fixtures.map((f) => f.input);
const motifs = (spec: DaySpec) =>
  spec.page.elements.flatMap((e) => (e.kind === 'sticker' ? [e.motif] : []));
const frames = (spec: DaySpec) =>
  spec.page.elements.flatMap((e) => (e.kind === 'photo' ? [e] : []));

describe('развороты скетчбука', () => {
  it('все демо-дни детерминированы и печатают каждый исходный кадр', () => {
    for (const { input } of fixtures) {
      const spec = buildDaySpec(input);
      expect(buildDaySpec(JSON.parse(JSON.stringify(input)))).toEqual(spec);
      expect(
        frames(spec)
          .map((e) => e.photoId)
          .sort(),
      ).toEqual(input.photos.map((p) => p.id).sort());
      expect(spec.page.elements.every((e) => e.w > 0 && e.h > 0)).toBe(true);
      expect(spec.why.map((w) => w.param)).toEqual(
        expect.arrayContaining([
          'page.lettering',
          'page.composition',
          'page.density',
          'page.mood',
          'page.object',
        ]),
      );
    }
  });
  it('047 и 048 расходятся по фразе, вещам, заголовку и раскладке на одних снимках', () => {
    const first = buildDaySpec(a),
      second = buildDaySpec(b);
    expect(a.photos.map((p) => p.src)).toEqual(b.photos.map((p) => p.src));
    expect(first.key.text).not.toBe(second.key.text);
    expect(first.folderName).not.toBe(second.folderName);
    expect(frames(first)).not.toEqual(frames(second));
    expect(motifs(first)).toEqual(
      expect.arrayContaining(['receipt', 'tangle-ink', 'crossout', 'heart']),
    );
    expect(motifs(second)).toEqual(expect.arrayContaining(['tea-sketch', 'ink-rain', 'ink-cloud']));
    expect(motifs(second).some((m) => ['heart', 'receipt', 'tangle-ink'].includes(m))).toBe(false);
    expect(second.page.elements.length).toBeLessThan(first.page.elements.length);
  });
  it('другая песня меняет алфавиты, число элементов и доли на том же тексте', () => {
    const fast = buildDaySpec(a),
      slow = buildDaySpec({ ...a, song: c.song });
    expect(fast.page.titleAlphabets).not.toEqual(slow.page.titleAlphabets);
    expect(slow.page.elements.length).toBeLessThan(fast.page.elements.length);
    expect(slow.reveal.beats).not.toEqual(fast.reveal.beats);
  });
  it('049 оставляет свободную бумагу, 050 получает бумагу и материалы плёночной записи', () => {
    const quiet = buildDaySpec(c),
      film = buildDaySpec(d);
    expect(quiet.page.elements.length).toBeGreaterThanOrEqual(12);
    expect(quiet.page.elements.length).toBeLessThanOrEqual(18);
    expect(quiet.page.titleAlphabets).toEqual(expect.arrayContaining(['book', 'typewriter']));
    expect(motifs(quiet)).toContain('pencil-sprig');
    expect(film.page.stock).toBe('aged');
    expect(film.page.titleAlphabets).toEqual(['news', 'xerox', 'stencil']);
    expect(motifs(film)).toEqual(expect.arrayContaining(['xerox', 'pin', 'paper-film']));
  });
  it('одно новое фото получает выкраску и разметку кадра даже без песни', () => {
    const input = {
      ...a,
      number: 53,
      text: 'Так и прошёл день.',
      photos: [{ ...a.photos[0], id: 'fresh', src: 'blob:photo' }],
      song: null,
      mood: undefined,
      weather: undefined,
    };
    const spec = buildDaySpec(input);
    expect(frames(spec)).toHaveLength(1);
    expect(motifs(spec)).toEqual(expect.arrayContaining(['paper-swatches', 'paper-tracing']));
  });
});

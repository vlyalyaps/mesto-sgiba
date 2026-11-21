import { describe, it, expect } from 'vitest';
import { fixtures } from '../fixtures';
import { buildDaySpec } from './index';
import type { DaySpec } from '../types/dayspec';
import { musicCarrier } from './musicCarrier';

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
    expect(motifs(film)).toEqual(expect.arrayContaining(['xerox', 'pin']));
  });
  it('одно новое фото получает подпись из записи без обязательной темы и песни', () => {
    const input = {
      ...a,
      number: 53,
      text: 'Так и прошёл день.',
      photos: [{ ...a.photos[0], id: 'fresh', src: 'blob:photo', caption: undefined }],
      song: null,
      mood: undefined,
      weather: undefined,
    };
    const spec = buildDaySpec(input);
    expect(frames(spec)).toHaveLength(1);
    expect(frames(spec)[0].caption).toBe('Так и прошёл день');
    expect(spec.page.elements.some((e) => e.kind === 'ticket')).toBe(false);
  });
  it('формат главного фото и длина записи меняют геометрию на тех же материалах', () => {
    const wide = buildDaySpec(a);
    const portrait = buildDaySpec({
      ...a,
      photos: a.photos.map((p) => ({ ...p, width: 350, height: 700 })),
    });
    expect(frames(portrait)).not.toEqual(frames(wide));
    expect(portrait.why.find((w) => w.param === 'page.composition')?.text).toContain(
      'вертикальный',
    );
    const long = buildDaySpec({ ...a, text: (a.text + ' ').repeat(4) });
    expect(long.page.elements.find((e) => e.kind === 'text')?.leaf).not.toBe(
      wide.page.elements.find((e) => e.kind === 'text')?.leaf,
    );
  });
  it('плотные 047 и 052 сопоставимы, 051 получает карту, а билет требует поездных слов', () => {
    const [mountains, train] = fixtures.slice(4).map((f) => buildDaySpec(f.input));
    expect(train.page.elements.length).toBeGreaterThanOrEqual(30);
    expect(
      Math.abs(train.page.elements.length - buildDaySpec(a).page.elements.length),
    ).toBeLessThanOrEqual(4);
    expect(motifs(mountains)).toEqual(expect.arrayContaining(['trail-map', 'trail-tag']));
    for (const motif of ['rail-ticket', 'paper-film', 'paper-swatches', 'paper-tracing'])
      expect(motifs(mountains)).not.toContain(motif);
    expect(motifs(buildDaySpec(a))).not.toContain('rail-ticket');
    expect(motifs(train)).toContain('rail-ticket');
  });
  it('еда, кино, автобус и вход оставляют свои бумажные следы', () => {
    for (const [text, motif] of [
      ['Обед в кафе.', 'food-receipt'],
      ['В кино.', 'cinema-ticket'],
      ['Ждал автобус.', 'bus-pass'],
      ['У входа на концерт.', 'entry-band'],
    ]) {
      const spec = buildDaySpec({ ...a, text });
      expect(motifs(spec)).toContain(motif);
      expect(motifs(spec)).not.toContain('rail-ticket');
    }
  });
});

it('музыкальный носитель меняется на границах эпох и объясняется в why', () => {
  expect([1979, 1980, 1995, 1996, 2005, 2006, 2014, 2015, 2026, null].map(musicCarrier)).toEqual([
    'vinyl',
    'cassette',
    'cassette',
    'cd',
    'cd',
    'mp3',
    'mp3',
    'stream',
    'stream',
    'note',
  ]);
  const film = buildDaySpec(d);
  const media = film.page.elements.find((e) => e.kind === 'ticket');
  expect(media).toMatchObject({ carrier: 'cassette' });
  expect(film.why.find((w) => w.param === 'page.carrier')?.text).toContain('1988');
});

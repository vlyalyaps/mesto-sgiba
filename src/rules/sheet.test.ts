import { describe, expect, it } from 'vitest';
import { parseSheet } from '../archive/parseSheet';
import { fixtures } from '../fixtures';
import type { DayInput, PageElement } from '../types/dayspec';
import type { SheetItem } from '../types/sheet';
import { buildDaySpec } from './index';
import {
  arrange,
  crossesSpine,
  EMPTY_DESIGN,
  rearrange,
  reflow,
  sheetItems,
  withSheet,
} from './sheet';

const added = (id = 'u1'): SheetItem => ({
  kind: 'image',
  asset: 'stickers/sun',
  id,
  leaf: 'right',
  x: 0.4,
  y: 0.4,
  w: 0.2,
  h: 0.16,
  rotation: 4,
  scale: 1,
  color: '#263653',
  layer: 4,
  at: 1,
});
const place = ({ x, y, w, h, leaf, rotation, scale }: PageElement) =>
  `${leaf} ${x} ${y} ${w} ${h} ${rotation} ${scale}`;
const input = fixtures[0].input;
const bare = buildDaySpec(input);
const build = (day: DayInput, design = day.overrides?.design) =>
  buildDaySpec({ ...day, overrides: { ...day.overrides, design } });

describe('лист автора', () => {
  it('без перестановок не двигает раскладку правил ни у одного дня', () => {
    for (const { input } of fixtures) {
      const rules = buildDaySpec(input);
      const edited = withSheet(rules, EMPTY_DESIGN);
      const visible = rules.page.elements.filter(
        (e) => e.kind !== 'sticker' || !e.motif.startsWith('sheet-'),
      );
      expect(edited.page.elements.map(place).sort()).toEqual(visible.map(place).sort());
      expect(edited.page.elements.map((e) => e.layer)).toEqual(
        visible.map((e) => e.layer).sort((a, b) => a - b),
      );
    }
  });

  it('свой стикер не останавливает правила: новая песня меняет лист', () => {
    const design = arrange(EMPTY_DESIGN, bare.page, (items) => [...items, added()]);
    expect(design.frozen).toBeUndefined();
    expect(design.items).toHaveLength(1);
    const day = { ...input, song: null };
    const edited = build(day, design);
    expect(edited.page.elements.some((e) => e.kind === 'ticket')).toBe(false);
    expect(edited.page.elements).toHaveLength(
      buildDaySpec(day).page.elements.filter(
        (e) => e.kind !== 'sticker' || !e.motif.startsWith('sheet-'),
      ).length + 1,
    );
    expect(edited.page.elements.at(-1)).toMatchObject({ kind: 'image', id: 'u1' });
  });

  it('тронутая вклейка правил запоминает весь лист', () => {
    const design = arrange(EMPTY_DESIGN, bare.page, ([first, ...rest]) => [
      ...rest,
      { ...first, x: 0.5 },
    ]);
    expect(design.frozen).toBeDefined();
    const other = build({ ...input, song: null, text: 'Тихо. Один.' }, design);
    const moved = other.page.elements.at(-1)!;
    expect(moved.x).toBe(0.5);
    expect(other.page.elements.find((e) => e.kind === 'text')).toMatchObject({
      sentences: ['Тихо.', 'Один.'],
    });
  });

  it('удалённое не возвращается, новое из записи появляется', () => {
    const day: DayInput = { ...input, mood: undefined };
    const page = buildDaySpec(day).page;
    const design = arrange(EMPTY_DESIGN, page, (items) => items.filter((e) => e.kind !== 'date'));
    const spec = build({ ...day, mood: 'joyful' }, design);
    expect(spec.page.elements.some((e) => e.kind === 'date')).toBe(false);
    expect(spec.page.elements.filter((e) => e.kind === 'mood')).toHaveLength(1);
  });

  it('пустую запись можно оформлять заранее, снимок придёт позже', () => {
    const empty: DayInput = { ...input, text: '', photos: [], song: null, mood: undefined };
    const page = buildDaySpec(empty).page;
    const design = arrange(EMPTY_DESIGN, page, (items) => items.slice(1));
    const spec = build({ ...empty, photos: input.photos }, design);
    expect(spec.page.elements.filter((e) => e.kind === 'photo')).toHaveLength(input.photos.length);
  });

  it('сначала лист, потом запись: нетронутое идёт за правилами, тронутое стоит', () => {
    for (const { input } of fixtures) {
      const empty: DayInput = { ...input, text: '', photos: [], song: null, mood: undefined };
      const before = buildDaySpec(empty).page;
      const design = arrange(EMPTY_DESIGN, before, (items) => [
        ...items.map((e) => (e.kind === 'date' ? { ...e, x: 0.31 } : e)),
        added(),
      ]);
      const rules = buildDaySpec(input);
      const edited = withSheet(rules, reflow(design, before, rules.page));
      expect(edited.page.elements.find((e) => e.kind === 'date')!.x).toBe(0.31);
      expect(edited.page.elements.filter((e) => e.id === 'u1')).toHaveLength(1);
      const untouched = rules.page.elements.filter(
        (e) => e.kind !== 'date' && (e.kind !== 'sticker' || !e.motif.startsWith('sheet-')),
      );
      expect(
        edited.page.elements
          .filter((e) => e.kind !== 'date' && e.id !== 'u1')
          .map(place)
          .sort(),
      ).toEqual(untouched.map(place).sort());
      expect(new Set(edited.page.elements.map((e) => e.id)).size).toBe(edited.page.elements.length);
    }
  });

  it('удалённое при дописывании записи не возвращается', () => {
    const empty: DayInput = { ...input, text: '', photos: [] };
    const before = buildDaySpec(empty).page;
    const design = arrange(EMPTY_DESIGN, before, (items) =>
      items.filter((e) => e.kind !== 'date' && e.kind !== 'ticket'),
    );
    const page = buildDaySpec(input).page;
    const items = reflow(design, before, page).items;
    expect(items.some((e) => e.kind === 'date' || e.kind === 'ticket')).toBe(false);
    expect(items.filter((e) => e.kind === 'photo')).toHaveLength(input.photos.length);
  });

  it('«разложить заново» оставляет добавленное', () => {
    const moved = arrange(EMPTY_DESIGN, bare.page, (items) => [...items.slice(1), added()]);
    const again = rearrange(moved);
    expect(again.frozen).toBeUndefined();
    expect(again.items.map((e) => e.id)).toEqual(['u1']);
    expect(sheetItems(again, bare.page).length).toBe(
      sheetItems(EMPTY_DESIGN, bare.page).length + 1,
    );
  });

  it('лист, сохранённый с прежними именами вклеек, открывается тем же', () => {
    const old = arrange(EMPTY_DESIGN, bare.page, ([first, ...rest]) => [
      ...rest,
      { ...first, x: 0.5 },
    ]);
    const design = { ...old, items: old.items.map((item, i) => ({ ...item, id: `auto-${i}` })) };
    const opened = build(input, design).page.elements;
    expect(opened.map(place)).toEqual(build(input, old).page.elements.map(place));
  });

  it('видит вклейку через сгиб', () => {
    expect(crossesSpine({ ...added(), leaf: 'left', x: 0.95 })).toBe(true);
    expect(crossesSpine({ ...added(), leaf: 'left', x: 0.2 })).toBe(false);
  });

  it('проходит через JSON и строгую проверку без потерь', () => {
    const design = arrange(EMPTY_DESIGN, bare.page, ([first, ...rest]) => [
      ...rest,
      { ...first, x: 0.3, look: { color: '#aa3322', font: 'cut-news' as const, frame: 'film' } },
      added(),
    ]);
    const full = {
      ...design,
      paper: { left: { texture: 'papers/marble', dark: true, ruling: 'grid' as const } },
      scene: { color: '#102030', texture: `photo:${input.photos[0].id}`, blur: 4 },
    };
    expect(parseSheet(JSON.parse(JSON.stringify(full)), Error)).toEqual(
      JSON.parse(JSON.stringify(full)),
    );
  });

  it('не пускает чужие ссылки, разметку стилей и опасные имена', () => {
    const bad = (why: string) => new Error(why);
    for (const broken of [
      { items: [{ ...added(), asset: '../secret' }] },
      { items: [{ ...added(), asset: 'stickers/../../x' }] },
      { items: [{ ...added(), asset: 'https://evil.example/x' }] },
      { items: [{ ...added(), color: 'red;background:url(x)' }] },
      { items: [{ ...added(), x: Number.NaN }] },
      { items: [{ ...added(), kind: 'sticker', motif: 'constructor' }] },
      { items: [{ ...added(), kind: 'sticker', motif: 'object-constructor' }] },
      { items: [added('a'), added('a')] },
      { items: [], scene: { texture: 'photo:"),url(x' } },
    ])
      expect(() => parseSheet({ v: 1, ...broken }, bad)).toThrow(/лист/);
  });
});

/** Строгая проверка листа из чужого ZIP: только известные поля, числа в границах, цвета в hex. */
import type { CutAlphabet, MusicCarrier, PaperStock, Point } from '../types/dayspec';
import type {
  ImageTone,
  LeafBase,
  LeafPaper,
  PieceLook,
  PrintFrame,
  Ruling,
  SheetContent,
  SheetDesign,
  SheetFont,
  SheetItem,
  SheetLeaf,
  SheetScene,
  SpiralLook,
} from '../types/sheet';

export const MAX_ITEMS = 400;
export const MAX_LABEL = 2000;

// Record, а не массив: забытое значение типа не соберётся.
const keys = <T extends string>(all: Record<T, 1>) => Object.keys(all) as T[];
const LEAVES = keys<SheetLeaf>({ left: 1, right: 1 });
const STOCKS = keys<PaperStock>({ cream: 1, white: 1, kraft: 1, aged: 1 });
const CARRIERS = keys<MusicCarrier>({ vinyl: 1, cassette: 1, cd: 1, mp3: 1, stream: 1, note: 1 });
const ALPHABETS = keys<CutAlphabet>({
  news: 1,
  gloss: 1,
  book: 1,
  typewriter: 1,
  stencil: 1,
  emboss: 1,
  kraft: 1,
  xerox: 1,
  neon: 1,
  note: 1,
  pixel: 1,
});
const FONTS: SheetFont[] = [
  ...keys<Exclude<SheetFont, `cut-${CutAlphabet}`>>({
    caveat: 1,
    'caveat-bold': 1,
    neucha: 1,
    literata: 1,
    'literata-italic': 1,
    'literata-bold': 1,
    golos: 1,
    'golos-black': 1,
    mono: 1,
  }),
  ...ALPHABETS.map((a): SheetFont => `cut-${a}`),
];
const FRAMES = keys<PrintFrame>({
  plain: 1,
  polaroid: 1,
  dark: 1,
  film: 1,
  torn: 1,
  round: 1,
  circle: 1,
  arch: 1,
  stamp: 1,
  none: 1,
});
const TONES = keys<ImageTone>({ bw: 1, sepia: 1, warm: 1, cool: 1, faded: 1, punchy: 1 });
const RULINGS = keys<Ruling>({
  plain: 1,
  ruled: 1,
  lines: 1,
  grid: 1,
  dots: 1,
  staff: 1,
  diagonal: 1,
});
const SPIRALS = keys<SpiralLook>({ metal: 1, dark: 1, gold: 1, white: 1, none: 1 });
const BLENDS = keys<NonNullable<PieceLook['blend']>>({
  normal: 1,
  multiply: 1,
  screen: 1,
  overlay: 1,
});
const ALIGNS = keys<NonNullable<PieceLook['align']>>({ left: 1, center: 1, right: 1 });
const SHEETS = ['', 'sheet-ruled', 'sheet-grid', 'sheet-dots', 'sheet-plain', 'sheet-kraft'];

const COLOR = /^#[0-9a-fA-F]{6}$/;
// Ни точек, ни двоеточий: путь не выйдет из папки ассетов и не станет чужой ссылкой.
const ASSET = /^(?:seasons|papers|stickers|scraps|letters|textures)(?:\/[a-z0-9-]{1,48}){1,2}$/;
const ID = /^[\w-]{1,90}$/;
const PHOTO = /^[\w-]{1,64}$/;

export function parseSheet(raw: unknown, bad: (why: string) => Error): SheetDesign {
  const fail = (what: string): never => {
    throw bad(`лист: ${what}`);
  };
  const obj = (v: unknown, what: string): Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : fail(`${what} не объект`);
  const num = (v: unknown, min: number, max: number, what: string): number =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
      ? v
      : fail(`${what} вне границ`);
  const one = <T extends string>(v: unknown, all: readonly T[], what: string): T =>
    typeof v === 'string' && (all as readonly string[]).includes(v)
      ? (v as T)
      : fail(`${what} неизвестно`);
  const str = (v: unknown, pattern: RegExp, what: string): string =>
    typeof v === 'string' && pattern.test(v) ? v : fail(`${what} некорректно`);
  const text = (v: unknown, max: number, what: string): string =>
    typeof v === 'string' && v.length <= max ? v : fail(`${what} слишком длинно`);
  const bool = (v: unknown, what: string): boolean =>
    typeof v === 'boolean' ? v : fail(`${what} не да и не нет`);
  const opt = <T>(v: unknown, read: (v: unknown) => T): T | undefined =>
    v == null ? undefined : read(v);
  const tidy = <T extends object>(v: T): T =>
    Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) as T;

  const color = (v: unknown) => str(v, COLOR, 'цвет');
  const texture = (v: unknown) =>
    typeof v === 'string' &&
    (v === 'none' || ASSET.test(v) || (v.startsWith('photo:') && PHOTO.test(v.slice(6))))
      ? v
      : fail('фактура некорректна');

  const look = (v: unknown): PieceLook => {
    const o = obj(v, 'вид вклейки');
    const range = (key: string, min: number, max: number) =>
      opt(o[key], (x) => num(x, min, max, key));
    return tidy<PieceLook>({
      opacity: range('opacity', 0, 1),
      flip: opt(o.flip, (x) => bool(x, 'отражение')),
      blend: opt(o.blend, (x) => one(x, BLENDS, 'наложение')),
      shadow: range('shadow', 0, 1),
      color: opt(o.color, color),
      fill: opt(o.fill, color),
      font: opt(o.font, (x) => one(x, FONTS, 'шрифт')),
      size: range('size', 0.5, 80),
      align: opt(o.align, (x) => one(x, ALIGNS, 'выключка')),
      upper: opt(o.upper, (x) => bool(x, 'прописные')),
      lineHeight: range('lineHeight', 0.5, 4),
      spacing: range('spacing', -0.5, 2),
      frame: opt(o.frame, (x) => one(x, FRAMES, 'рамка')),
      tone: opt(o.tone, (x) => one(x, TONES, 'обработка')),
      brightness: range('brightness', 0, 4),
      contrast: range('contrast', 0, 4),
      saturation: range('saturation', 0, 4),
      hue: range('hue', -360, 360),
      zoom: range('zoom', 1, 8),
      pan: opt(o.pan, (x): Point => {
        const p = obj(x, 'сдвиг кадра');
        return { x: num(p.x, 0, 1, 'сдвиг'), y: num(p.y, 0, 1, 'сдвиг') };
      }),
      clip: opt(o.clip, (x) => bool(x, 'обрез')),
    });
  };

  const content = (o: Record<string, unknown>): SheetContent => {
    switch (o.kind) {
      case 'photo':
        return tidy<SheetContent>({
          kind: 'photo',
          photoId: str(o.photoId, PHOTO, 'фото'),
          caption: opt(o.caption, (x) => text(x, 500, 'подпись')),
        });
      case 'tape':
        return { kind: 'tape', photoId: str(o.photoId, PHOTO, 'фото скотча') };
      case 'text':
      case 'date':
      case 'mood':
      case 'weather':
        return { kind: o.kind };
      case 'ticket':
        return tidy<SheetContent>({
          kind: 'ticket',
          carrier: opt(o.carrier, (x) => one(x, CARRIERS, 'носитель')),
        });
      case 'sticker': {
        const motif = str(o.motif, /^[a-z0-9-]{1,48}$/, 'рисунок');
        // «constructor» и подобные имена нашлись бы в любом словаре рисунков.
        return motif.replace(/^object-/, '') in Object.prototype
          ? fail('рисунок некорректен')
          : { kind: 'sticker', motif };
      }
      case 'label':
        return { kind: 'label', text: text(o.text, MAX_LABEL, 'надпись') };
      case 'image':
        return { kind: 'image', asset: str(o.asset, ASSET, 'картинка') };
      default:
        return fail('неизвестная вклейка');
    }
  };

  const ids = new Set<string>();
  const item = (v: unknown): SheetItem => {
    const o = obj(v, 'вклейка');
    const id = str(o.id, ID, 'id');
    if (ids.has(id)) fail('id повторяются');
    ids.add(id);
    const out: SheetItem = {
      ...content(o),
      id,
      leaf: one(o.leaf, LEAVES, 'страница'),
      x: num(o.x, -200, 200, 'x'),
      y: num(o.y, -200, 200, 'y'),
      w: num(o.w, 0.00001, 200, 'ширина'),
      h: num(o.h, 0.00001, 200, 'высота'),
      rotation: num(o.rotation, -3600, 3600, 'поворот'),
      scale: num(o.scale, 0.0001, 30, 'масштаб'),
      color: color(o.color),
      layer: num(o.layer, 0, 10, 'слой'),
      at: num(o.at, 0, 1, 'время'),
    };
    if (o.look != null) out.look = look(o.look);
    return out;
  };

  const paper = (v: unknown): LeafPaper => {
    const o = obj(v, 'бумага');
    return tidy<LeafPaper>({
      texture: opt(o.texture, texture),
      color: opt(o.color, color),
      strength: opt(o.strength, (x) => num(x, 0, 1, 'оттенок')),
      zoom: opt(o.zoom, (x) => num(x, 0.1, 5, 'размер фактуры')),
      ruling: opt(o.ruling, (x) => one(x, RULINGS, 'линовка')),
      line: opt(o.line, color),
      dark: opt(o.dark, (x) => bool(x, 'тёмная бумага')),
    });
  };

  const scene = (v: unknown): SheetScene => {
    const o = obj(v, 'фон');
    return tidy<SheetScene>({
      color: opt(o.color, color),
      texture: opt(o.texture, texture),
      dim: opt(o.dim, (x) => num(x, 0, 1, 'затемнение')),
      blur: opt(o.blur, (x) => num(x, 0, 80, 'размытие')),
      glow: opt(o.glow, color),
      glowPower: opt(o.glowPower, (x) => num(x, 0, 1, 'свет')),
      light: opt(o.light, (x) => bool(x, 'светлый фон')),
      stars: opt(o.stars, (x) => bool(x, 'пыль')),
      sparks: opt(o.sparks, (x) => bool(x, 'искры')),
      orbits: opt(o.orbits, (x) => bool(x, 'орбиты')),
    });
  };

  const root = obj(raw, 'правки');
  if (root.v !== 1) fail('неизвестная версия');
  if (!Array.isArray(root.items) || root.items.length > MAX_ITEMS) fail('слишком много вклеек');
  const design: SheetDesign = { v: 1, items: (root.items as unknown[]).map(item) };

  if (root.frozen != null) {
    const o = obj(root.frozen, 'основа');
    const leaves = obj(o.leaves, 'страницы');
    const base = (v: unknown): LeafBase => {
      const b = obj(v, 'основа страницы');
      return { stock: one(b.stock, STOCKS, 'бумага'), sheet: one(b.sheet, SHEETS, 'линовка') };
    };
    if (!Array.isArray(o.seen) || o.seen.length > MAX_ITEMS * 3) fail('список записи некорректен');
    design.frozen = {
      seen: (o.seen as unknown[]).map((x) => str(x, ID, 'часть записи')),
      leaves: { left: base(leaves.left), right: base(leaves.right) },
      emphasis: bool(o.emphasis, 'акцент'),
    };
  }
  if (root.paper != null) {
    const o = obj(root.paper, 'бумага');
    design.paper = tidy({ left: opt(o.left, paper), right: opt(o.right, paper) });
  }
  if (root.scene != null) design.scene = scene(root.scene);
  if (root.spiral != null) design.spiral = one(root.spiral, SPIRALS, 'пружина');
  if (root.marker != null) design.marker = color(root.marker);
  return design;
}

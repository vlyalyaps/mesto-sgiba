/** Всё, что можно положить на лист: сезонные наборы и весь визуал проекта. */
import { localPapers, localStickers, type LocalSticker } from '../../render/assets';
import { drawings } from '../../render/stickers/art';
import { moodLabel } from '../../render/stickers/Sticker';
import type { CutAlphabet, Mood, MusicCarrier } from '../../types/dayspec';
import type { PieceLook, SheetContent } from '../../types/sheet';

export interface Cutout {
  key: string;
  title: string;
  content: SheetContent;
  /** Ширина в долях листа и отношение ширины к высоте. */
  w: number;
  ratio: number;
  layer: number;
  color?: string;
  look?: PieceLook;
  rotation?: number;
}

export interface CutoutGroup {
  id: string;
  title: string;
  items: Cutout[];
}

function picture(
  asset: string,
  title: string,
  width: number,
  height: number,
  w = 0.28,
  look?: PieceLook,
): Cutout {
  return {
    key: `image:${asset}`,
    title,
    content: { kind: 'image', asset },
    w,
    ratio: width / height,
    layer: look?.blend === 'multiply' ? 1 : 4,
    look,
  };
}

/** Рисунок или вещь, которую рисует сам проект: размеры в процентах листа. */
function motif(name: string, title: string, w: number, h: number, layer = 5): Cutout {
  return {
    key: `sticker:${name}`,
    title,
    content: { kind: 'sticker', motif: name },
    w: w / 100,
    ratio: w / (h * 1.25),
    layer,
  };
}

const SEASONS: Record<LocalSticker['season'], string> = {
  autumn: 'Осень',
  winter: 'Зима',
  spring: 'Весна',
  summer: 'Лето',
};

const seasonal: CutoutGroup[] = (Object.keys(SEASONS) as LocalSticker['season'][]).map(
  (season) => ({
    id: season,
    title: SEASONS[season],
    items: localStickers
      .filter((s) => s.season === season)
      .map((s) =>
        picture(s.id, s.title, s.w, s.h, s.w > s.h * 1.7 ? 0.36 : s.w < s.h * 0.7 ? 0.17 : 0.26),
      ),
  }),
);

const things: [name: string, title: string, w: number, h: number][] = [
  ['arrow', 'Стрелка', 342, 253],
  ['camera', 'Камера', 360, 272],
  ['case', 'Чемодан', 341, 325],
  ['clock', 'Часы', 302, 360],
  ['cup', 'Стакан', 308, 279],
  ['flower', 'Цветок', 320, 337],
  ['leaf', 'Лист', 333, 329],
  ['moon', 'Луна', 286, 313],
  ['mountain', 'Горы', 307, 341],
  ['sun', 'Солнце', 346, 341],
  ['ticket', 'Билет', 359, 248],
  ['train', 'Поезд', 360, 298],
];
const illustrated = new Set(things.map(([name]) => name));
const multiply: PieceLook = { blend: 'multiply' };
const moods: Mood[] = ['calm', 'joyful', 'tired', 'restless', 'wistful', 'curious', 'proud'];

export const PAPERS: { id: string; title: string; dark: boolean }[] = [
  { id: 'textures/cream', title: 'Кремовая', dark: false },
  { id: 'textures/white', title: 'Белая', dark: false },
  { id: 'textures/aged', title: 'Пожелтевшая', dark: false },
  { id: 'textures/kraft', title: 'Крафт', dark: false },
  { id: 'textures/desk', title: 'Фанера', dark: false },
  { id: 'textures/cloth', title: 'Ткань', dark: true },
  { id: 'textures/tape', title: 'Малярная лента', dark: false },
  ...localPapers.map(({ id, title, dark }) => ({ id, title, dark })),
];

export const GROUPS: CutoutGroup[] = [
  ...seasonal.filter((group) => group.items.length),
  {
    id: 'things',
    title: 'Вещи',
    items: things.map(([name, title, w, h]) => picture(`stickers/${name}`, title, w, h)),
  },
  {
    id: 'fasteners',
    title: 'Скотч и скрепки',
    items: [
      picture('scraps/047/masking', 'Бумажный скотч', 289, 113, 0.3),
      picture('scraps/047/black-tape', 'Чёрная изолента', 300, 75, 0.3),
      picture('scraps/047/checks', 'Клетчатый скотч', 302, 157, 0.28),
      picture('scraps/life/tape-ghost', 'След скотча', 271, 118, 0.26, multiply),
      picture('scraps/047/pin', 'Булавка', 300, 76, 0.22),
      picture('scraps/047/clip', 'Скрепка', 103, 297, 0.06),
      picture('scraps/life/worn-clip', 'Старая скрепка', 117, 304, 0.06),
      picture('scraps/047/binder', 'Зажим', 219, 268, 0.12),
      picture('scraps/047/wire-loop', 'Виток пружины', 175, 66, 0.14),
      picture('scraps/life/photo-corner', 'Фотоуголок', 241, 243, 0.14),
    ],
  },
  {
    id: 'paper',
    title: 'Бумага',
    items: [
      picture('scraps/047/looseleaf', 'Лист в линейку', 287, 280, 0.55),
      picture('scraps/047/graph', 'Миллиметровка', 276, 287, 0.5),
      picture('scraps/047/xerox', 'Ксерокопия', 279, 295, 0.5),
      picture('scraps/life/newsprint', 'Газета', 310, 290, 0.42),
      picture('scraps/life/folded', 'Сложенный листок', 300, 256, 0.34),
      picture('scraps/life/sticky', 'Жёлтый стикер', 297, 211, 0.34),
      picture('scraps/life/paper-label', 'Ярлык', 320, 209, 0.36),
      picture('scraps/life/pocket', 'Конверт', 299, 251, 0.45),
      picture('scraps/life/vellum', 'Калька', 307, 253, 0.4, { blend: 'multiply', opacity: 0.6 }),
      picture('scraps/047/receipt', 'Пустой чек', 204, 299, 0.24),
      picture('scraps/047/show-stub', 'Корешок билета', 307, 151, 0.4),
      picture('scraps/047/rail-ticket', 'Пустой билет', 300, 166, 0.42),
      picture('scraps/materials/trail-map', 'Карта тропы', 575, 314, 0.5),
      motif('life-folded', 'Записка, которая раскрывается', 30, 19, 6),
      motif('life-sticky', 'Стикер, который отгибается', 26, 15, 6),
      motif('life-pocket', 'Кармашек для снимков', 80, 17, 6),
      ...PAPERS.map((paper) =>
        picture(paper.id, `Клочок: ${paper.title.toLowerCase()}`, 4, 3, 0.4),
      ),
    ],
  },
  {
    id: 'traces',
    title: 'Следы',
    items: [
      picture('scraps/047/tea-ring', 'След кружки', 280, 285, 0.36, {
        blend: 'multiply',
        opacity: 0.4,
      }),
      picture('scraps/life/blot', 'Клякса', 288, 282, 0.24, { blend: 'multiply', opacity: 0.5 }),
      picture('scraps/life/dried-flower', 'Сухой цветок', 207, 315, 0.2),
      picture('scraps/life/dried-leaf', 'Сухой лист', 236, 316, 0.2),
      motif('bent-corner', 'Загнутый угол', 14, 11, 1),
      motif('reverse-ink', 'Оттиск с оборота', 60, 23, 1),
      motif('erased-graphite', 'Стёртый карандаш', 43, 7.5, 1),
    ],
  },
  {
    id: 'tickets',
    title: 'Билеты и штампы',
    items: [
      motif('rail-ticket', 'Билет на поезд', 60, 27, 4),
      motif('receipt', 'Чек из буфета', 25, 31, 4),
      motif('luggage-tag', 'Багажная бирка', 34, 17),
      motif('trail-tag', 'Бирка тропы', 20, 9),
      motif('cinema-ticket', 'Кинобилет', 32, 14),
      motif('bus-pass', 'Автобус', 30, 13),
      motif('food-receipt', 'Кассовый чек', 30, 14),
      motif('entry-band', 'Браслет на вход', 30, 10),
      motif('postmark', 'Почтовый штемпель', 32, 15),
      motif('punch-stamp', 'Оттиск с галочкой', 19, 14),
      motif('life-date-stamp', 'Штамп даты', 30, 7),
      motif('rail-label', 'В пути', 28, 12),
      motif('tea-label', 'Чай', 28, 12),
      motif('ridge-label', 'Горы', 28, 12),
      motif('life-bridge', 'Ярлык «снимки»', 28, 10),
      motif('paper-swatches', 'Цвета снимка', 30, 10),
      motif('paper-film', 'Обрезок плёнки', 34, 10),
      motif('paper-graph', 'Разметка кадра', 36, 12),
    ],
  },
  {
    id: 'pen',
    title: 'Ручка',
    items: [
      motif('pen-arrow', 'Стрелка ручкой', 26, 8),
      motif('pen-bolts', 'Молнии', 24, 9),
      motif('tangle-ink', 'Каракули', 22, 18),
      motif('tea-sketch', 'Чай ручкой', 18, 21),
      motif('train-ink', 'Поезд ручкой', 30, 14),
      motif('case', 'Чемодан ручкой', 22, 16),
      motif('ink-cloud', 'Облако', 22, 12),
      motif('ink-rain', 'Дождь', 20, 11),
      motif('pencil-sprig', 'Веточка', 22, 12),
      motif('pencil-lines', 'Штрихи', 30, 10),
      motif('ink-exclaim', 'Восклицания', 20, 11),
      motif('ink-route', 'Маршрут', 26, 14),
      motif('ink-question', 'Вопросы', 18, 10),
      motif('ink-clock', 'Часы ручкой', 20, 11),
      motif('ink-mountain', 'Горы ручкой', 28, 15),
      motif('ink-sun', 'Солнце ручкой', 22, 12),
      motif('heart', 'Сердце', 7, 5),
      motif('crossout', 'Зачёркнуто', 20, 6),
      motif('repeat-note', '«Ещё раз!»', 24, 5),
      motif('tea-note', '«Чай ещё тёплый»', 38, 5),
      motif('life-photo-arrow', 'Стрелка к снимку', 14, 8),
    ],
  },
  {
    id: 'badges',
    title: 'Значки',
    items: [
      ...moods.map((mood) => motif(mood, moodLabel(mood), 16, 12.8)),
      ...Object.keys(drawings)
        .filter((name) => !illustrated.has(name) && name !== 'spark' && name !== 'star')
        .map((name) => motif(`object-${name}`, drawings[name][0], 16, 12.8)),
      motif('spark', 'Искры', 16, 10.4),
    ],
  },
  {
    id: 'audio',
    title: 'Музыка',
    items: [
      picture('scraps/materials/vinyl', 'Пластинка', 571, 351, 0.5),
      picture('scraps/materials/cassette', 'Кассета', 519, 322, 0.48),
      picture('scraps/materials/cd', 'Диск', 575, 278, 0.52),
      picture('scraps/materials/mp3', 'Плейлист', 565, 324, 0.5),
      picture('scraps/materials/stream', 'Экран плеера', 531, 329, 0.48),
    ],
  },
];

export const ALPHABETS: { id: CutAlphabet; title: string }[] = [
  { id: 'news', title: 'Газета' },
  { id: 'gloss', title: 'Глянец' },
  { id: 'book', title: 'Антиква' },
  { id: 'typewriter', title: 'Машинка' },
  { id: 'stencil', title: 'Трафарет' },
  { id: 'emboss', title: 'Тиснение' },
  { id: 'kraft', title: 'Крафт' },
  { id: 'xerox', title: 'Ксерокс' },
  { id: 'neon', title: 'Неон' },
  { id: 'note', title: 'Записка' },
  { id: 'pixel', title: 'Пиксели' },
];

export const LETTERS = Array.from('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ');

export function letter(set: CutAlphabet, char: string): Cutout {
  const asset = `letters/${set}/${char.codePointAt(0)!.toString(16)}`;
  return picture(asset, `Буква ${char}`, 4, 5, 0.12);
}

export const CARRIERS: { id: MusicCarrier; title: string }[] = [
  { id: 'vinyl', title: 'Пластинка' },
  { id: 'cassette', title: 'Кассета' },
  { id: 'cd', title: 'Диск' },
  { id: 'mp3', title: 'Плейлист' },
  { id: 'stream', title: 'Плеер' },
  { id: 'note', title: 'Записка' },
];

const byKey = new Map(GROUPS.flatMap((group) => group.items).map((item) => [item.key, item]));

export function cutoutByKey(key: string): Cutout | undefined {
  const known = byKey.get(key);
  if (known) return known;
  const found = /^image:letters\/([a-z]+)\/([0-9a-f]+)$/.exec(key);
  const set = found && ALPHABETS.find((a) => a.id === found[1]);
  return set ? letter(set.id, String.fromCodePoint(parseInt(found[2], 16))) : undefined;
}

/** Набор, с которого открываются стикеры: время года этого дня, если оно есть. */
export function startGroup(date: string): string {
  const month = Number(date.slice(5, 7));
  const season =
    month < 3 || month === 12 ? 'winter' : month < 6 ? 'spring' : month < 9 ? 'summer' : 'autumn';
  return GROUPS.some((group) => group.id === season) ? season : GROUPS[0].id;
}

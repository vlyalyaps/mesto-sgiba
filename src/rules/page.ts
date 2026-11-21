import type {
  DayInput,
  DaySpec,
  PageContent,
  PageElement,
  PageSpec,
  WhyLine,
} from '../types/dayspec';
import { objectsIn } from './objects';
import { selectAlphabets } from './titleLetters';
import type { TextRules } from './text';
import { clamp, quoteList, seeded } from './util';

type Leaf = PageElement['leaf'];
type Box = [x: number, y: number, width: number, height: number, tilt?: number];
type Draft = Pick<DaySpec, 'id' | 'photos' | 'mode' | 'reveal'>;

const moods = {
  restless: {
    motifs: ['tangle-ink', 'pen-bolts', 'crossout'],
    why: 'каракули, молнии и зачёркнутая пометка',
    ink: '#8b3d2c',
  },
  wistful: {
    motifs: ['ink-cloud', 'ink-rain'],
    why: 'облако и мелкий дождь ручкой',
    ink: '#3a5069',
  },
  calm: {
    motifs: ['pencil-sprig', 'pencil-lines'],
    why: 'тонкая веточка и мягкий карандаш',
    ink: '#545850',
  },
  joyful: {
    motifs: ['pen-bolts', 'ink-exclaim'],
    why: 'звёздочка, молнии и восклицание ручкой',
    ink: '#8b3d2c',
  },
  tired: { motifs: ['pencil-lines', 'ink-cloud'], why: 'вялые линии и облако', ink: '#545850' },
  curious: {
    motifs: ['ink-route', 'ink-question'],
    why: 'пунктирный маршрут и вопрос на полях',
    ink: '#3a5069',
  },
  proud: {
    motifs: ['punch-stamp', 'pen-arrow', 'ink-exclaim'],
    why: 'оттиск с галочкой, энергичная стрелка и восклицание',
    ink: '#354f46',
  },
};

export function buildPage(
  input: DayInput,
  spec: Draft,
  text: TextRules,
): { page: PageSpec; why: WhyLine[] } {
  const random = seeded(spec.id);
  const energy = clamp(
    Number.isFinite(input.song?.features?.energy) ? input.song!.features!.energy : 0.45,
    0,
    1,
  );
  const photos = [...spec.photos].sort(
    (a, b) => Number(b.role === 'key') - Number(a.role === 'key'),
  );
  const [hero, ...other] = photos;
  const hits = objectsIn(text.sentences);
  const has = (motif: string) => hits.some((hit) => hit.motif === motif);
  const tea = has('cup');
  const twoTeas = /(?:два|две)\s+(?:стакан|чаш)/iu.test(input.text);
  const travel = has('train') || has('ticket');
  const mood = input.mood;
  const quiet = energy < 0.4 || (mood === 'calm' && energy < 0.58);
  const separated = photos.length === 2 && (text.company.alone.length > 0 || mood === 'wistful');
  const crowded = energy > 0.72 && !separated && (mood === 'restless' || photos.length >= 3);
  const old = spec.mode === 'film' || (input.song?.year ?? 2100) < 2000;
  const stock = old ? 'aged' : quiet || separated ? 'white' : crowded ? 'kraft' : 'cream';
  const marker = quiet ? '#c4c6b6' : separated ? '#a7bcb6' : old ? '#e4b66d' : '#edc74b';
  const why: WhyLine[] = [];
  const reason = (param: string, message: string) =>
    why.push({ param: 'page.' + param, text: message });
  const elements: PageElement[] = [];
  const items: PageElement[][] = [[], [], [], [], []];
  function add(
    content: PageContent,
    leaf: Leaf,
    [x, y, w, h, rotation = 0]: Box,
    layer: number,
    phase: number,
    color = '#263653',
  ) {
    items[phase].push({
      ...content,
      leaf,
      x: x / 100,
      y: y / 100,
      w: w / 100,
      h: h / 100,
      rotation,
      layer,
      beat: 0,
      scale: 1,
      color,
    });
  }
  function scrap(motif: string, leaf: Leaf, box: Box, layer = 5, phase = 4) {
    add({ kind: 'sticker', motif }, leaf, box, layer, phase);
  }
  function print(
    photo: DaySpec['photos'][number],
    leaf: Leaf,
    box: Box,
    fastening: 'tape' | 'pin' | 'none',
    caption?: string,
  ) {
    add({ kind: 'photo', photoId: photo.photoId }, leaf, box, 3, 2);
    const [x, y, w, h, rotation = 0] = box;
    if (fastening === 'pin') scrap('pin', leaf, [x + w * 0.77, y - 2, w * 0.21, 5, -18], 5, 3);
    if (fastening === 'tape') {
      const black = crowded ? '#24221e' : '#d8c194';
      add(
        { kind: 'tape', photoId: photo.photoId },
        leaf,
        [x + w * 0.16, y - 2, w * 0.33, 4.7, rotation - 8],
        5,
        3,
        black,
      );
    }
    if (caption) scrap(caption, leaf, [x + w * 0.08, y + h + 1, w * 0.8, 5, rotation * 0.4], 5, 4);
  }

  const profile =
    photos.length >= 3
      ? 'contact'
      : quiet
        ? 'quiet'
        : separated
          ? 'separate'
          : photos.length <= 1
            ? 'single'
            : crowded
              ? 'overlap'
              : 'stacked';
  const titleBoxes: Record<typeof profile, Box> = {
    quiet: [10, 9, 75, 18, -2],
    separate: [7, 10, 84, 22, 1],
    contact: [8, 8, 82, 20, -3],
    single: [8, 7, 82, 19, -4],
    overlap: [5, 9, 85, 25, -4],
    stacked: [7, 9, 83, 21, -3],
  };
  const bodies: Record<typeof profile, Box> = {
    quiet: [12, 16, 75, 44, -1],
    separate: [12, 15, 75, 29, -1],
    contact: [12, 13, 73, 27, -2],
    single: [12, 17, 74, 32, -1],
    overlap: [12, 13, 69, 30, -2],
    stacked: [12, 15, 75, 29, -1],
  };
  const ticketBoxes: Record<typeof profile, Box> = {
    quiet: [18, 77, 56, 15, -2],
    separate: [17, 80, 64, 16, 4],
    contact: [29, 81, 64, 17, -4],
    single: [22, 78, 66, 17, -4],
    overlap: [31, 79, 62, 19, -5],
    stacked: [20, 80, 68, 17, -4],
  };
  const textHeight = Math.min(52, Math.max(bodies[profile][3], 10 + text.words * 0.55));
  const long = textHeight > bodies[profile][3];
  const textBox: Box = [
    bodies[profile][0],
    bodies[profile][1],
    long ? 77 : bodies[profile][2],
    textHeight,
    bodies[profile][4],
  ];
  const lower = textBox[1] + textHeight;
  scrap('title', 'left', titleBoxes[profile], 4, 1);
  add({ kind: 'date' }, 'left', [8, 2, 52, 6, -3], 4, 0);
  add(
    { kind: 'text', sentences: text.sentences },
    'right',
    textBox,
    4,
    1,
    mood ? moods[mood].ink : '#263653',
  );
  if (mood) add({ kind: 'mood', mood }, 'right', [10, 3, 40, 8, -4], 4, 1);
  if (input.weather)
    add({ kind: 'weather', weather: input.weather }, 'right', [63, 2, 31, 9, 3], 4, 1);
  if (input.song) add({ kind: 'ticket' }, 'right', ticketBoxes[profile], 4, 3);

  if (profile === 'overlap') {
    scrap('xerox', 'left', [-6, 27, 63, 54, -12], 2, 0);
    scrap('graph', 'left', [42, 27, 52, 51, 8], 2, 0);
    scrap('looseleaf', 'right', [3, 45, 55, 40, -9], 2, 0);
    scrap('clip', 'left', [87, 8, 3.8, 10, -11], 5, 3);
    print(hero, 'left', [10, 35, 76, 44, -7], 'tape', tea ? 'tea-note' : undefined);
    add({ kind: 'tape', photoId: hero.photoId }, 'left', [67, 31, 21, 6, 15], 5, 3, '#d8c194');
    add({ kind: 'tape', photoId: hero.photoId }, 'left', [72, 73, 20, 6, -29], 5, 3, '#57514a');
    const rightPhotoY = Math.max(47, lower + 4);
    print(other[0], 'right', [31, rightPhotoY, 59, Math.min(32, 78 - rightPhotoY), 8], 'tape');
    scrap('clip', 'right', [77, rightPhotoY - 2, 5, 10, -8], 5, 3);
    if (twoTeas && !long) {
      scrap('receipt', 'right', [9, 48, 22.5, 38, -10], 4, 3);
      scrap('checks', 'right', [6, 47, 19, 5.3, -22], 5, 3);
      scrap('punch-stamp', 'right', [13, 73, 14, 11, -13], 5);
    }
    if (travel || has('case')) {
      scrap('rail-ticket', 'left', [6, 80, 58, 18, -6], 4, 3);
      scrap('binder', 'left', [1, 77, 12, 10, 13], 5, 3);
      if (!has('train')) scrap('train-ink', 'left', [64, 1, 24, 9, 7]);
    }
    scrap('pin', 'right', [82, 70, 13, 6, -28], 5, 3);
    if (input.song) {
      scrap('pen-arrow', 'right', [7, 87, 21, 8, -14]);
      scrap('repeat-note', 'right', [9, 94, 21, 5, -5]);
    }
  } else if (profile === 'quiet') {
    if (hero) print(hero, 'left', [14, 34, 68, 35, -3], 'tape');
    if (other.length) print(other[0], 'left', [42, 73, 37, 21, 6], 'none');
    other
      .slice(1)
      .forEach((photo, i) =>
        print(photo, 'left', [8 + i * 12, 76 + i * 3, 24, 17, -5 + i * 4], 'none'),
      );
    scrap(tea ? 'tea-ring' : 'looseleaf', 'left', [5, 62, 33, 26, -9], 2, 0);
    scrap(tea ? 'tea-sketch' : 'pencil-sprig', 'left', [14, 81, 19, 15, 8]);
    if (travel) scrap('rail-ticket', 'right', [26, 55, 48, 12, -4], 4, 3);
  } else if (profile === 'separate') {
    scrap('graph', 'left', [9, 33, 59, 58, -10], 2, 0);
    print(hero, 'left', [10, 39, 74, 43, 5], 'tape');
    print(
      other[0],
      'right',
      [42, Math.max(41, lower + 3), 45, Math.min(29, 77 - Math.max(41, lower + 3)), -7],
      'none',
    );
    scrap('clip', 'right', [78, 40, 5, 10, -12], 5, 3);
    if (travel) scrap('rail-ticket', 'left', [22, 78, 58, 16, 9], 4, 3);
    if (tea) scrap('tea-sketch', 'right', [13, 47, 23, 26, -7]);
    scrap('pen-arrow', 'left', [7, 84, 16, 9, -9]);
  } else if (profile === 'contact') {
    scrap('xerox', 'left', [-3, 27, 61, 54, -8], 2, 0);
    scrap('graph', 'left', [30, 56, 64, 30, 8], 2, 0);
    print(hero, 'left', [9, 34, 80, 46, -4], 'tape');
    const railY = Math.max(44, lower + 2);
    other.forEach((photo, i) => {
      if (i < 2)
        print(
          photo,
          'right',
          [10 + i * 41, railY + i * 2, 42, Math.min(30, 76 - railY), i === 0 ? -7 : 6],
          i === 0 ? 'tape' : 'pin',
        );
      else print(photo, 'left', [11 + (i - 2) * 39, 77, 36, 20, i === 2 ? -5 : 6], 'none');
    });
    scrap('binder', 'left', [6, 30, 12, 9, -18], 5, 3);
    if (other.length < 3)
      scrap(travel ? 'rail-ticket' : 'looseleaf', 'left', [12, 81, 57, 16, -5], 4, 3);
    scrap('black-tape', 'right', [43, 72, 21, 5, 12], 5, 3);
  } else if (profile === 'single') {
    scrap('graph', 'left', [11, 27, 81, 59, 7], 2, 0);
    if (hero) print(hero, 'left', [9, 32, 81, 47, -6], old ? 'pin' : 'tape');
    scrap('paper-swatches', 'left', [18, 85, 36, 8, -5], 4, 4);
    scrap('paper-tracing', 'right', [21, Math.max(52, lower + 3), 55, 16, 6], 4, 3);
    if (old) scrap('paper-film', 'left', [61, 82, 28, 6, 10], 4, 3);
    if (has('mountain')) scrap('ink-route', 'left', [52, 84, 39, 12, 7]);
  } else {
    scrap('xerox', 'left', [-4, 26, 69, 39, -12], 2, 0);
    scrap('graph', 'left', [41, 45, 55, 46, 7], 2, 0);
    print(hero, 'left', [9, 34, 80, 38, -8], old ? 'pin' : 'tape');
    print(other[0], 'left', [42, 73, 48, 23, 7], old ? 'pin' : 'tape');
    scrap('looseleaf', 'right', [15, 47, 69, 28, -6], 2, 0);
    if (travel) scrap('rail-ticket', 'right', [21, 54, 61, 17, 7], 4, 3);
    if (old) scrap('paper-film', 'right', [20, 71, 45, 6, -10], 4, 3);
  }

  const lettering = selectAlphabets(input.song);
  why.push(lettering.why);
  reason(
    'stock',
    old
      ? 'Год песни и плёночная обработка оставили желтоватую бумагу и выцветший отпечаток.'
      : quiet
        ? 'Тихий ритм оставил свободное поле на светлом линованном листе.'
        : 'Линованный лист держит запись, на соседнем листе собраны отпечатки.',
  );
  reason(
    'composition',
    {
      quiet: 'Негромкой записи оставлены широкий отступ и свободные строки.',
      separate: 'Два отпечатка разнесены по разным листам, между ними остаётся свободное поле.',
      contact: 'Главное фото занимает один лист, меньшие кадры собраны рядом с текстом.',
      single: 'Один большой отпечаток и свободное поле для записи и деталей.',
      overlap: 'Короткие фразы и быстрый темп собирают бумагу, фото и крепления внахлёст.',
      stacked: 'Два отпечатка лежат под разными углами на общем листе.',
    }[profile],
  );
  if (twoTeas && profile === 'overlap' && !long)
    reason('receipt', 'Два стакана в записи оставили чек на два чая.');
  if (items.some((group) => group.some((e) => e.kind === 'sticker' && e.motif === 'rail-ticket')))
    reason(
      'ticket',
      travel
        ? 'Слова о дороге оставили железнодорожный билет.'
        : 'Чемодан и спешка оставили дорожный билет.',
    );
  if (tea && profile !== 'quiet' && profile !== 'separate')
    scrap('tea-ring', 'right', [66, 9, 36, 28, 16], 2, 0);

  for (const [i, hit] of hits
    .filter((hit) => profile !== 'overlap' || hit.motif !== 'clock')
    .slice(0, crowded ? 5 : quiet ? 2 : 4)
    .entries()) {
    const art: Record<string, string> = {
      cup: 'tea-sketch',
      case: 'case',
      train: 'train-ink',
      clock: 'ink-clock',
      mountain: 'ink-mountain',
      sun: 'ink-sun',
      ticket: 'ink-clock',
    };
    if (hit.motif === 'cup' && (profile === 'quiet' || separated)) {
      reason('object', `Слово «${hit.word}» оставило рисунок одного стакана.`);
      continue;
    }
    const at =
      profile === 'overlap'
        ? [
            [72, 80, 20, 15],
            [53, 39, 13, 10],
            [64, 1, 24, 9],
            [-1, 57, 12, 14],
            [81, 36, 15, 10],
          ][i]
        : profile === 'single'
          ? [
              [67, 1, 21, 8],
              [63, 43, 29, 11],
              [8, 69, 20, 11],
              [72, 68, 19, 10],
            ][i]
          : profile === 'separate'
            ? [
                [9, 31, 16, 9],
                [60, 28, 18, 8],
                [10, 65, 20, 10],
                [79, 10, 13, 10],
              ][i]
            : profile === 'quiet'
              ? [
                  [70, 62, 17, 10],
                  [9, 51, 21, 10],
                ][i]
              : [
                  [68, 1, 22, 8],
                  [9, 70, 17, 11],
                  [65, 39, 25, 10],
                  [1, 54, 11, 11],
                ][i];
    const leaf =
      profile === 'overlap'
        ? i === 1 || i === 4
          ? 'right'
          : 'left'
        : profile === 'single'
          ? i === 0
            ? 'left'
            : 'right'
          : profile === 'quiet'
            ? 'right'
            : i === 0 || i === 3
              ? 'left'
              : 'right';
    if (long && leaf === 'right' && at[1] < lower && at[1] + at[3] > textBox[1]) continue;
    scrap(art[hit.motif] ?? 'object-' + hit.motif, leaf, [
      at[0],
      at[1],
      at[2],
      at[3],
      Math.round(random() * 16 - 8),
    ]);
    reason('object', `Слово «${hit.word}» оставило рисунок на полях.`);
  }

  if (mood) {
    const spots: Box[] =
      profile === 'overlap'
        ? [
            [83, 14, 15, 13, 8],
            [75, 34, 22, 13, -8],
            [9, 38, 20, 5, -9],
          ]
        : profile === 'quiet'
          ? [
              [77, 34, 16, 22, 4],
              [20, 49, 39, 6, -2],
            ]
          : profile === 'separate'
            ? [
                [77, 25, 20, 15, 7],
                [7, 77, 14, 11, -4],
              ]
            : profile === 'contact'
              ? [
                  [76, 31, 19, 11, -7],
                  [8, 88, 18, 8, -9],
                  [76, 88, 15, 8, 7],
                ]
              : [
                  [79, 32, 17, 12, 7],
                  [9, 73, 23, 8, -9],
                  [77, 69, 14, 8, 7],
                ];
    moods[mood].motifs.forEach((motif, i) => {
      const box = spots[i];
      if (box && !long) scrap(motif, 'right', box);
    });
    if (!long) reason('mood', `Настроение записи подсказало рисунки: ${moods[mood].why}.`);
  }
  const together = [
    ...text.company.we.filter((w) => w === 'мы'),
    ...text.company.names,
    ...text.company.near.filter((w) => w === 'рядом'),
  ];
  if (together.length) {
    scrap(
      'heart',
      'right',
      [Math.min(84, profile === 'overlap' ? 55 : 77), Math.min(73, lower - 5), 5, 4, -11],
      5,
    );
    reason('heart', `Одно маленькое сердце оставили слова ${quoteList(together)}.`);
  }

  elements.push(...items.flat());
  const lastBeat = spec.reveal.beats.length - 1;
  elements.forEach((element, index) => {
    element.beat = Math.round((Math.max(0, lastBeat) * index) / Math.max(1, elements.length - 1));
  });
  reason(
    'density',
    `Энергия песни — ${Math.round(energy * 100)}%. ${quiet ? 'Тихий темп оставил меньше деталей.' : separated ? 'Раздельная композиция бережёт пустое поле.' : crowded ? 'Быстрый ритм допускает больше креплений и наложений.' : 'Элементы собираются свободными группами.'} На листах ${elements.length} элементов.`,
  );
  if (input.song)
    reason('rhythm', 'Корешок билета отмечает доли, большой отпечаток появляется на пике песни.');
  return { page: { stock, marker, elements, titleAlphabets: lettering.alphabets }, why };
}

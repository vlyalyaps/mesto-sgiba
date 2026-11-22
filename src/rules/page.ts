import type {
  DayInput,
  DaySpec,
  PageContent,
  PageElement,
  PageSpec,
  WhyLine,
} from '../types/dayspec';
import { objectsIn } from './objects';
import { keepsakeNames, keepsakes } from './keepsakes';
import { carrierLabels, musicCarrier } from './musicCarrier';
import { printCaption } from './printCaption';
import { isPaperTrace, paperLife } from './paperLife';
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

type Composition = 'collage' | 'column' | 'full' | 'split';
type Place = [leaf: Leaf, box: Box];

function composition(
  input: DayInput,
  photoId: string | undefined,
  energy: number,
  words: number,
  alone: boolean,
): Composition {
  const frame = input.photos.find((p) => p.id === photoId);
  const upright = frame && frame.height > frame.width * 1.08;
  if (words > 34 || upright) return 'column';
  if (input.photos.length === 1) return 'full';
  if (energy >= 0.72 && input.photos.length >= 2 && !alone) return 'collage';
  if (words >= 11 && energy >= 0.46 && !alone) return 'column';
  return 'split';
}

export function buildPage(
  input: DayInput,
  spec: Draft,
  text: TextRules,
): { page: PageSpec; why: WhyLine[] } {
  const random = seeded(spec.id);
  const rawEnergy = input.song?.features?.energy;
  const energy = clamp(
    rawEnergy !== undefined && Number.isFinite(rawEnergy) ? rawEnergy : 0.45,
    0,
    1,
  );
  const [hero, ...other] = [...spec.photos].sort(
    (a, b) => Number(b.role === 'key') - Number(a.role === 'key'),
  );
  const plural = other.length >= 2;
  const quiet = energy < 0.4;
  const alone = text.company.alone.length > 0 || input.mood === 'wistful';
  const layout = composition(input, hero?.photoId, energy, text.words, alone);
  const crowded = layout === 'collage' && !quiet;
  const old = spec.mode === 'film' || (input.song?.year ?? 2100) < 2000;
  const stock = old ? 'aged' : quiet || alone ? 'white' : crowded ? 'kraft' : 'cream';
  const marker = quiet ? '#c4c6b6' : alone ? '#a7bcb6' : old ? '#e4b66d' : '#edc74b';
  const hits = objectsIn(text.sentences);
  const has = (motif: string) => hits.some((hit) => hit.motif === motif);
  const tea = has('cup');
  const twoTeas = tea && /(?:два|две)\s+(?:стакан|чаш)/iu.test(input.text);
  const mood = input.mood;
  const why: WhyLine[] = [];
  const reason = (param: string, line: string) => why.push({ param: 'page.' + param, text: line });
  const items: PageElement[][] = [[], [], [], [], []];

  function add(
    content: PageContent,
    [leaf, [x, y, w, h, rotation = 0]]: Place,
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
    add({ kind: 'sticker', motif }, [leaf, box], layer, phase);
  }
  function tape(photoId: string, leaf: Leaf, box: Box, type: 'black' | 'plain' | 'check') {
    add(
      { kind: 'tape', photoId },
      [leaf, box],
      5,
      3,
      { black: '#24221e', plain: '#d8c194', check: '#57514a' }[type],
    );
  }
  function print(
    photo: DaySpec['photos'][number],
    leaf: Leaf,
    box: Box,
    fastening: 'pin' | 'tape' | 'none',
  ) {
    const caption = printCaption(input, photo, text.key.text, text.sentences);
    add({ kind: 'photo', photoId: photo.photoId, caption }, [leaf, box], 3, 2);
    const [x, y, w, , rotation = 0] = box;
    if (fastening === 'pin') scrap('pin', leaf, [x + w * 0.77, y - 2, w * 0.21, 5, -18], 5, 3);
    if (fastening === 'tape')
      tape(
        photo.photoId,
        leaf,
        [x + w * 0.16, y - 2, w * 0.32, 4.7, rotation - 8],
        crowded ? 'black' : 'plain',
      );
  }

  let title: Place,
    body: Place,
    music: Place,
    souvenirs: Place[],
    doodles: Place[],
    objects: Place[];
  const maxText = Math.min(65, Math.max(26, 12 + text.words * 0.57));
  const mediumHeight = Math.min(35, maxText);
  if (layout === 'collage' && !plural && hero) {
    title = ['left', [5, 9, 85, 25, -4]];
    body = ['right', [12, 13, 69, 29, -2]];
    music = ['right', [31, 79, 62, 19, -5]];
    souvenirs = [
      ['left', [7, 81, 56, 17, -7]],
      ['right', [11, 60, 24, 29, 7]],
    ];
    doodles = [
      ['right', [82, 14, 16, 14, 9]],
      ['right', [75, 34, 22, 12, -8]],
      ['right', [9, 38, 20, 5, -9]],
    ];
    objects = [
      ['left', [72, 81, 20, 15, 8]],
      ['right', [54, 37, 15, 11, -8]],
      ['left', [64, 1, 23, 9, 9]],
    ];
    scrap('xerox', 'left', [-6, 27, 63, 54, -12], 2, 0);
    scrap('graph', 'left', [42, 27, 52, 51, 8], 2, 0);
    scrap('looseleaf', 'right', [3, 43, 55, 42, -9], 2, 0);
    print(hero, 'left', [10, 35, 76, 44, -7], 'tape');
    print(other[0], 'right', [32, 45, 59, 34, 7], 'tape');
    tape(hero.photoId, 'left', [67, 31, 21, 6, 15], 'plain');
    tape(hero.photoId, 'left', [72, 73, 20, 6, -29], 'check');
    scrap('clip', 'left', [87, 8, 3.8, 10, -11], 5, 3);
    scrap('clip', 'right', [78, 43, 5, 10, -8], 5, 3);
    scrap('pin', 'right', [82, 71, 13, 6, -28], 5, 3);
    scrap('binder', 'left', [1, 77, 12, 10, 13], 5, 3);
    scrap('life-vellum', 'left', [69, 33, 22, 30, 13], 6, 4);
    scrap('life-sticky', 'right', [77, 35, 23, 12, -10], 6, 4);
    scrap('life-date-stamp', 'left', [0, 87, 28, 8, -16], 6, 4);
    reason(
      'touch',
      'Быстрый ритм добавил кальку на угол отпечатка, отгибаемую заметку и оттиск даты.',
    );
    if (tea) scrap('tea-note', 'left', [61, 96, 34, 4, -4]);
    if (twoTeas) {
      scrap('receipt', 'right', [9, 48, 23, 37, -10], 4, 3);
      scrap('checks', 'right', [6, 47, 19, 5, -22], 5, 3);
      scrap('punch-stamp', 'right', [13, 73, 14, 11, -13]);
      reason('receipt', 'Два стакана в записи оставили чек на два чая.');
    }
    if (input.song) {
      scrap('pen-arrow', 'right', [7, 87, 21, 8, -14]);
      scrap('repeat-note', 'right', [9, 94, 21, 5, -5]);
    }
  } else if (layout === 'collage' && hero) {
    title = ['right', [11, 12, 81, 22, 2]];
    body = ['left', [9, 14, 77, 23, -2]];
    music = ['left', [8, 78, 66, 19, 4]];
    souvenirs = [
      ['right', [23, 82, 59, 17, -5]],
      ['left', [76, 78, 20, 17, -7]],
    ];
    doodles = [
      ['right', [10, 36, 15, 10, -13]],
      ['left', [77, 72, 17, 9, -12]],
      ['left', [68, 27, 21, 8, 5]],
    ];
    objects = [
      ['right', [69, 35, 25, 10, 12]],
      ['left', [73, 89, 23, 8, 7]],
      ['right', [9, 88, 13, 9, -7]],
    ];
    scrap('looseleaf', 'left', [5, 9, 78, 32, -5], 2, 0);
    scrap('graph', 'left', [36, 43, 56, 43, 8], 2, 0);
    scrap('xerox', 'right', [39, 22, 63, 63, 10], 2, 0);
    print(hero, 'right', [11, 43, 80, 39, -5], 'tape');
    other.forEach((photo, i) =>
      print(
        photo,
        'left',
        other.length > 2
          ? [8 + (i % 2) * 43, 39 + Math.floor(i / 2) * 19, 39, 18, i % 2 === 0 ? -7 : 7]
          : [8 + i * 42, 38 + i * 4, 42, 28, i === 0 ? -6 : 7],
        other.length === 2 ? 'none' : i === 0 ? 'tape' : 'pin',
      ),
    );
    tape(hero.photoId, 'right', [70, 43, 20, 5, 18], 'plain');
    tape(hero.photoId, 'right', [66, 77, 24, 4, -17], 'check');
    if (other.length === 2) {
      scrap('life-pocket', 'left', [4, 60, 91, 17, -2], 6, 4);
      scrap('life-worn-clip', 'left', [9, 58, 5, 12, -18], 7, 4);
      reason(
        'pocket',
        'Два малых кадра собраны в кармашек. Их можно выдвинуть и открыть по одному.',
      );
    } else {
      tape(other.at(-1)!.photoId, 'left', [62, 66, 20, 4, -11], 'plain');
    }
    scrap('life-folded', 'left', [77, 78, 22, 15, 7], 6, 4);
    scrap('life-bridge', 'left', [88, 85, 24, 7, -3], 7, 4);
    scrap('life-bridge', 'right', [-12, 85, 24, 7, -3], 7, 4);
    scrap('life-newsprint', 'right', [76, 72, 24, 21, 13], 2, 0);
    reason(
      'touch',
      'Плотный ритм оставил сложенную записку, газетный клочок и ярлык поверх сгиба.',
    );
    scrap('clip', 'right', [84, 28, 4, 11, -8], 5, 3);
    scrap('binder', 'left', [4, 69, 11, 9, -13], 5, 3);
    scrap('ink-route', 'left', [62, 8, 26, 7, -7]);
    scrap('ink-clock', 'right', [82, 82, 15, 10, -10]);
    scrap('pen-bolts', 'right', [67, 92, 23, 7, -7]);
    scrap('pencil-lines', 'left', [9, 70, 33, 5, -8]);
    scrap('punch-stamp', 'right', [75, 34, 17, 12, 11]);
    scrap('masking', 'left', [38, 77, 25, 5, -9], 5, 3);
    scrap('repeat-note', 'left', [76, 93, 18, 5, 5]);
  } else if (layout === 'full' && hero) {
    title = ['right', [12, 13, 79, 22, -3]];
    // Длинная запись над сувениром со входа пишется мельче и заканчивается выше него.
    const crowded = text.words > 24 && keepsakes(hits).length > 0;
    body = ['right', [13, 38, 76, crowded ? 15 : 22, -2]];
    music = ['right', [18, 79, 48, 20, -5]];
    souvenirs = [
      ['right', [22, 57, 62, 20, -7]],
      ['right', [10, 68, 29, 13, 5]],
    ];
    doodles = [
      ['right', [76, 62, 19, 10, 9]],
      ['right', [80, 73, 16, 8, -8]],
    ];
    objects = [
      ['left', [78, 7, 17, 11, 9]],
      ['left', [9, 84, 18, 10, -12]],
    ];
    scrap('graph', 'left', [0, 17, 88, 68, -5], 2, 0);
    print(hero, 'left', [-1, 19, 97, 66, -3], old ? 'pin' : 'tape');
    tape(hero.photoId, 'left', [10, 81, 27, 6, -7], 'plain');
    scrap('life-photo-corner', 'left', [85, 74, 13, 12, 180], 5, 4);
    scrap('life-tape-ghost', 'left', [64, 89, 25, 6, 9], 1, 0);
    if (has('mountain') || has('leaf') || has('flower')) {
      scrap(
        has('flower') ? 'life-dried-flower' : 'life-dried-leaf',
        'right',
        [80, 53, 17, 22, 18],
        6,
        4,
      );
      reason(
        'botanical',
        'Слова о природе оставили засушенный образец рядом с картой и карандашными штрихами.',
      );
    }
  } else if (layout === 'column') {
    const long = text.words > 34;
    title = ['left', [9, 9, 78, 22, -3]];
    body = ['left', [10, 37, long ? 76 : 59, long ? 50 : maxText, -2]];
    music = long ? ['right', [11, 82, 58, 16, -4]] : ['left', [16, 73, 59, 24, -5]];
    souvenirs = [
      ['right', [14, 81, 60, 15, -7]],
      ['left', [64, 41, 28, 30, 7]],
    ];
    if (long) souvenirs.splice(0, 2, ['left', [13, 89, 60, 9, -4]]);
    doodles = [
      ['left', [76, 37, 17, 13, 6]],
      ['right', [78, 81, 18, 10, -5]],
      ['left', [70, 64, 23, 10, -5]],
    ];
    if (long) doodles.splice(0, 3, ['right', [79, 83, 17, 9, 6]]);
    objects = [
      ['right', [66, 5, 23, 9, 9]],
      ['left', [70, 62, 17, 11, -8]],
      ['left', [71, 51, 18, 10, 6]],
    ];
    if (long) objects.splice(0, 3, ['right', [68, 4, 22, 8, 3]]);
    scrap('looseleaf', 'left', [6, 30, 80, long ? 54 : 47, 4], 2, 0);
    scrap('xerox', 'right', [-2, 19, 70, 47, -8], 2, 0);
    scrap('life-newsprint', 'right', [78, 36, 28, 28, 11], 2, 0);
    if (!long) scrap('life-folded', 'left', [68, 52, 29, 18, 7], 6, 4);
    scrap('life-date-stamp', 'right', [9, 88, 23, 8, -12], 5, 4);
    reason(
      'touch',
      'Плёночное поле собрано из газетной вырезки и штампа. Короткая фраза помещается в складную записку.',
    );
    if (hero)
      print(hero, 'right', heroBox(input, hero.photoId, other.length === 0), old ? 'pin' : 'tape');
    other.forEach((photo, i) =>
      print(
        photo,
        'right',
        other.length === 1
          ? [42, 57, 48, 24, 8]
          : [10 + (i % 2) * 44, 53 + Math.floor(i / 2) * 13, 37, 15, i % 2 === 0 ? -5 : 6],
        i < 2 ? (old ? 'pin' : 'tape') : 'none',
      ),
    );
  } else {
    title = ['right', quiet ? [17, 19, 70, 17, -2] : [10, 11, 81, 21, -3]];
    body = ['right', quiet ? [18, 40, 71, 34, -1] : [13, 36, 75, mediumHeight, -2]];
    music = quiet ? ['left', [10, 81, 58, 16, -4]] : ['right', [28, 81, 65, 18, 4]];
    souvenirs = quiet ? [['left', [10, 65, 43, 12, -5]]] : [['left', [51, 86, 42, 11, 5]]];
    doodles = quiet
      ? [
          ['right', [77, 63, 16, 16, 4]],
          ['right', [14, 75, 29, 6, -2]],
        ]
      : [
          ['right', [75, 60, 20, 13, 7]],
          ['left', [6, 83, 14, 12, -4]],
        ];
    objects = quiet
      ? [
          ['left', [69, 82, 18, 13, 9]],
          ['right', [74, 79, 16, 13, 7]],
        ]
      : [
          ['left', [76, 4, 17, 11, -11]],
          ['left', [10, 69, 23, 16, 7]],
          ['right', [16, 72, 21, 10, 6]],
        ];
    scrap(tea ? 'tea-ring' : 'graph', 'left', [3, 50, 41, 38, -9], 2, 0);
    if (hero) print(hero, 'left', quiet ? [11, 19, 75, 37, 3] : [10, 17, 77, 41, -5], 'tape');
    other.forEach((photo, i) =>
      print(
        photo,
        i > 1 ? 'right' : 'left',
        other.length === 1
          ? quiet
            ? [54, 60, 38, 21, 8]
            : [39, 64, 47, 24, 8]
          : [11 + (i % 2) * 43, i > 1 ? 70 : 60, 39, 19, i % 2 === 0 ? -5 : 6],
        'none',
      ),
    );
    if (quiet) {
      scrap('life-sticky', 'right', [19, 72, 25, 16, -8], 5, 4);
      if (tea) scrap('life-blot', 'left', [12, 48, 24, 16, 12], 1, 0);
      reason('touch', 'На тихих полях только отгибаемая заметка и слабый след от напитка.');
    } else if (alone) {
      scrap('life-folded', 'right', [19, 59, 45, 19, -7], 6, 4);
      scrap('life-tape-ghost', 'left', [15, 60, 24, 6, 6], 1, 0);
      if (hero) scrap('life-photo-arrow', 'right', [1, 47, 16, 8, 11], 5, 4);
      reason(
        'touch',
        'Фраза об одиночестве лежит в сложенной записке. Стрелка ведёт от записи к кадру, возле которого остался след отклеенной ленты.',
      );
    }
  }

  reason(
    'handwriting',
    'Синие чернила держат основной текст, выделение и приписки меняют нажим и цвет. Пометки отсылают к вклейкам.',
  );

  const [textLeaf] = body;
  const dateLeaf = title[0] === 'left' ? 'left' : 'right';
  add({ kind: 'date' }, [dateLeaf, [11, 2, 51, 6, -3]], 4, 0);
  scrap('title', title[0], title[1], 4, 1);
  add({ kind: 'text', sentences: text.sentences }, body, 4, 1, mood ? moods[mood].ink : '#263653');
  if (mood) {
    const labelSide = title[0] === 'right' && textLeaf === 'right' ? 'left' : textLeaf;
    const position: Box = labelSide !== dateLeaf ? [9, 3, 38, 8, -4] : [68, 1.5, 28, 7, 1];
    add({ kind: 'mood', mood }, [labelSide, position], 4, 1);
  }
  if (input.weather)
    add({ kind: 'weather', weather: input.weather }, ['right', [64, 2, 30, 8, 3]], 4, 1);
  if (input.song) {
    const carrier = musicCarrier(input.song.year);
    add({ kind: 'ticket', carrier }, music, 4, 3);
    reason(
      'carrier',
      input.song.year === null
        ? `Год песни неизвестен. Название осталось на бумажной заметке.`
        : `Песня ${input.song.year} года. Её носитель — ${carrierLabels[carrier]}.`,
    );
    reason('rhythm', 'Доли и пик нанесены на носитель. Главный кадр появляется на пике.');
    const genre = input.song.genre ?? '';
    if (carrier === 'cd' && /dance|electr|танц|электр/iu.test(genre)) {
      scrap('life-label-digital', dateLeaf, [56, 3, 13, 5, 8], 5, 4);
      reason('musicAccent', 'Электроника эпохи CD оставила наклейку с пиксельной подписью года.');
    } else if (carrier === 'cassette' && /rock|punk|metal|рок|панк|метал/iu.test(genre)) {
      scrap(
        'life-worn-clip',
        music[0],
        [music[1][0] + music[1][2] - 5, music[1][1] + 4, 5, 11, -16],
        7,
        4,
      );
      reason('musicAccent', 'Рок кассетной эпохи добавил потёртую скрепку к вклейке с песней.');
    } else if (/classical|piano|классич|фортепиан/iu.test(genre)) {
      scrap('life-vellum', music[0], [music[1][0] - 2, music[1][1] - 2, 14, 9, -4], 3, 3);
      reason('musicAccent', 'К камерной записи оставлена небольшая калька под вкладышем.');
    }
  }

  const frame = input.photos.find((p) => p.id === hero?.photoId);
  const shape = frame
    ? frame.height > frame.width * 1.08
      ? 'вертикальный'
      : frame.width > frame.height * 1.08
        ? 'горизонтальный'
        : 'почти квадратный'
    : '';
  reason(
    'composition',
    `Снимков: ${spec.photos.length}${shape ? ', главный ' + shape : ''}. Слов в записи: ${text.words}. Энергия песни: ${Math.round(100 * energy)}%. ${
      {
        collage: plural
          ? 'Плотный коллаж: два меньших кадра и запись на одном листе, заголовок и крупный отпечаток на другом.'
          : 'Отпечатки, скотч и вырезки собраны внахлёст.',
        full: 'Один отпечаток почти во весь лист, заголовок и запись на соседнем.',
        split: quiet
          ? 'Два поля с широкими отступами. Тихой записи оставлена пустая бумага.'
          : 'Фотографии собраны свободной группой, а заголовок расположен над записью на соседнем листе.',
        column: 'Запись идёт отдельным столбиком, рядом расположены отпечатки.',
      }[layout]
    }`,
  );
  reason(
    'stock',
    old
      ? 'Год песни подсказал пожелтевшую бумагу и плёночные тона.'
      : 'Запись опирается на линованные листы и бумажные обрезки.',
  );
  reason(
    'captions',
    'На рамках — подписи к тому, что видно на снимке, и короткие фразы из записи.',
  );
  keepsakes(hits)
    .slice(0, souvenirs.length)
    .forEach(({ motif, word }, i) => {
      const [leaf, box] = souvenirs[i];
      const mapBox: Box =
        motif === 'trail-map' ? [box[0], box[1], box[2], box[3] + 2, box[4]] : box;
      scrap(motif, leaf, mapBox, 4, 3);
      if (motif === 'trail-map')
        scrap('trail-tag', leaf, [box[0] + box[2] - 15, box[1] + box[3] - 3, 17, 10, 11], 5, 4);
      reason('keepsake', `Слово «${word}» оставило на листе предмет «${keepsakeNames[motif]}».`);
    });
  if (tea && layout === 'collage' && !plural) scrap('tea-ring', 'right', [66, 9, 36, 28, 16], 2, 0);

  const art: Record<string, string> = {
    cup: 'tea-sketch',
    case: 'case',
    train: 'train-ink',
    clock: 'ink-clock',
    mountain: 'ink-mountain',
    sun: 'ink-sun',
    ticket: 'ink-clock',
  };
  const objectHits = hits.filter((hit) => {
    if (layout === 'collage' && !plural) return hit.motif !== 'clock';
    return hit.motif !== 'ticket' || !has('clock');
  });
  objectHits.slice(0, objects.length).forEach((hit, i) => {
    const [leaf, [x, y, w, h]] = objects[i];
    scrap(art[hit.motif] ?? 'object-' + hit.motif, leaf, [
      x,
      y,
      w,
      h,
      Math.round(random() * 14 - 7),
    ]);
    reason('object', `Слово «${hit.word}» оставило рисунок на полях.`);
  });
  if (mood) {
    moods[mood].motifs.slice(0, doodles.length).forEach((motif, i) => {
      const [leaf, box] = doodles[i];
      scrap(motif, leaf, box);
    });
    reason('mood', `Настроение записи подсказало рисунки: ${moods[mood].why}.`);
  }
  const together = [
    ...text.company.we.filter((w) => w === 'мы'),
    ...text.company.names,
    ...text.company.near.filter((w) => w === 'рядом'),
  ];
  if (together.length) {
    const [, [x, y, w, h]] = body;
    scrap('heart', textLeaf, [x + w - 4, y + h - 5, 5, 4, -11]);
    reason('heart', `Одно маленькое сердце оставили слова ${quoteList(together)}.`);
  }

  reason('paper', paperLife(input, spec.id, energy, has, items.flat(), scrap));
  const lettering = selectAlphabets(input.song);
  why.push(lettering.why);
  const elements = items.flat();
  const pieces = elements.filter((e) => e.kind !== 'sticker' || !isPaperTrace(e.motif)).length;
  const lastBeat = Math.max(0, spec.reveal.beats.length - 1);
  elements.forEach((e, i) => {
    e.beat = Math.round((lastBeat * i) / Math.max(1, elements.length - 1));
  });
  reason(
    'density',
    `Энергия песни — ${Math.round(100 * energy)}%. ${quiet ? 'Тихий ритм оставил меньше деталей.' : crowded ? 'Высокая энергия добавила крепления и наложения.' : alone ? 'Рассказ об одиночестве оставил больше места между деталями.' : 'Предметы и крепления собраны в небольшие группы.'} На листах ${elementCount(pieces)}.`,
  );
  return { page: { stock, marker, elements, titleAlphabets: lettering.alphabets }, why };
}

export function elementCount(count: number) {
  const last = count % 10;
  const teen = count % 100 >= 11 && count % 100 <= 14;
  const noun = teen || last === 0 || last >= 5 ? 'элементов' : last === 1 ? 'элемент' : 'элемента';
  return `${count} ${noun}`;
}

function heroBox(input: DayInput, id: string, only: boolean): Box {
  const photo = input.photos.find((p) => p.id === id);
  const upright = photo && photo.height > photo.width * 1.08;
  return upright ? [13, 13, only ? 73 : 62, only ? 73 : 49, -5] : [10, 15, 82, only ? 57 : 40, -5];
}

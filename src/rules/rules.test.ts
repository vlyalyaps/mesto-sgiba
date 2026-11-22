import { describe, expect, it } from 'vitest';
import { fixtures } from '../fixtures';
import type { DayInput, DaySpec, PhotoInput, SongInput } from '../types/dayspec';
import { buildDaySpec, dayId } from './index';
import { contrast, pickInk } from './photo';
import { findStems } from './stems';
import { splitSentences } from './text';

const HEX = /^#[0-9a-f]{6}$/i;

function fixture(file: string): DayInput {
  const f = fixtures.find((x) => x.file.startsWith(file));
  if (!f) throw new Error(`нет контрольного дня ${file}`);
  return f.input;
}

function photo(id: string, extra: Partial<PhotoInput> = {}): PhotoInput {
  return {
    id,
    src: `demo/photos/${id}.svg`,
    width: 800,
    height: 1000,
    palette: ['#25314a', '#a9654f', '#efb47c', '#151515'],
    lightness: 0.4,
    ...extra,
  };
}

function song(extra: Partial<SongInput> & { bpm?: number; energy?: number } = {}): SongInput {
  const { bpm = 100, energy = 0.5, ...rest } = extra;
  return {
    source: 'itunes',
    trackId: 1,
    title: 'Песня',
    artist: 'Исполнитель',
    trackViewUrl: null,
    previewUrl: null,
    artworkUrl: null,
    year: 2015,
    genre: null,
    features: { bpm, energy, energySpread: 0.2, peakSec: 15, measured: false },
    ...rest,
  };
}

function day(text: string, extra: Partial<DayInput> = {}): DayInput {
  return {
    date: '2026-11-20',
    number: 1,
    text,
    photos: [photo('a'), photo('b')],
    song: song(),
    ...extra,
  };
}

/** То, что должно быть верно для любого дня. */
function checkInvariants(spec: DaySpec) {
  const words = spec.folderName.trim().split(/\s+/);
  expect(words.length).toBeGreaterThanOrEqual(3);
  expect(words.length).toBeLessThanOrEqual(7);
  expect(spec.folderName[0]).toBe(spec.folderName[0].toUpperCase());
  expect(spec.folderName).not.toMatch(/[.!?…]$/);

  for (const f of spec.folds) {
    expect(f.width).toBeGreaterThanOrEqual(0);
    expect(f.width).toBeLessThanOrEqual(1);
  }
  expect(spec.ink).toMatch(HEX);
  expect(contrast(spec.ink, '#f3efe6')).toBeGreaterThanOrEqual(4.5);
  for (const c of spec.duo) expect(c).toMatch(HEX);

  const p = spec.paper;
  for (const v of [p.brightness, p.shadow, p.margin, p.age, p.grain, spec.rhythm.density]) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  }
  for (const v of [p.tone, p.spreadTone]) {
    expect(v).toBeGreaterThanOrEqual(-1);
    expect(v).toBeLessThanOrEqual(1);
  }
  for (const ph of spec.photos) {
    expect(ph.crop.x).toBeGreaterThanOrEqual(0);
    expect(ph.crop.y).toBeGreaterThanOrEqual(0);
    expect(ph.crop.x + ph.crop.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(ph.crop.y + ph.crop.h).toBeLessThanOrEqual(1 + 1e-9);
  }
  expect(spec.photos.filter((ph) => ph.role === 'key')).toHaveLength(1);

  expect(spec.why.length).toBeGreaterThan(0);
  for (const w of spec.why) {
    expect(w.param.length).toBeGreaterThan(0);
    expect(w.text.length).toBeGreaterThan(10);
    expect(w.text).not.toContain('!');
  }

  if (spec.reveal.peakSec !== null) {
    expect(spec.reveal.prerollSec).toBeLessThanOrEqual(spec.reveal.peakSec);
    expect(spec.reveal.peakSec - spec.reveal.prerollSec).toBeGreaterThanOrEqual(0);
  }
  expect(spec.reveal.durationMs).toBeGreaterThan(0);
}

describe('контрольные дни: ожидания expect', () => {
  for (const f of fixtures) {
    it(f.file, () => {
      const spec = buildDaySpec(f.input);
      const got: Record<string, string> = {
        'key.by': spec.key.by,
        folderName: spec.folderName,
        layout: spec.layout,
        mode: spec.mode,
      };
      for (const [k, want] of Object.entries(f.expect)) {
        if (k === 'key.text startsWith') {
          expect(spec.key.text.startsWith(want), `${k}: «${spec.key.text}»`).toBe(true);
        } else {
          expect(got[k], k).toBe(want);
        }
      }
    });

    it(`${f.file}: инварианты`, () => checkInvariants(buildDaySpec(f.input)));

    it(`${f.file}: детерминизм`, () => {
      expect(buildDaySpec(f.input)).toEqual(buildDaySpec(structuredClone(f.input)));
    });
  }

  it('047: переход «а потом» делает главной фразу после него, ранние фразы — узкие складки', () => {
    const spec = buildDaySpec(fixture('047'));
    expect(spec.key.by).toBe('transition');
    expect(spec.key.transition).toBe('а потом');
    expect(spec.key.sentence).toBe(2);
    const before = spec.folds.filter((f) => f.side === 'before');
    const after = spec.folds.filter((f) => f.side === 'after');
    expect(before).toHaveLength(2);
    expect(after).toHaveLength(1);
    expect(Math.max(...before.map((f) => f.width))).toBeLessThan(after[0].width);
    expect(spec.rhythm.beatsPerFold).toBe(4);
  });
});

describe('главный показ: те же фото, другой рассказ', () => {
  const a = buildDaySpec(fixture('047'));
  const b = buildDaySpec(fixture('048'));

  it('фото и песня те же', () => {
    const photos = (id: string) =>
      fixture(id).photos.map(({ caption: _caption, ...photo }) => photo);
    expect(photos('048')).toEqual(photos('047'));
    expect(fixture('048').song).toEqual(fixture('047').song);
  });

  it('главная фраза, складки и название папки разные', () => {
    expect(b.key).not.toEqual(a.key);
    expect(b.folds).not.toEqual(a.folds);
    expect(b.folderName).not.toBe(a.folderName);
  });

  it('«один» разводит кадры, «рядом» сводит внахлёст', () => {
    expect(a.photos.every((p) => p.overlap)).toBe(true);
    expect(b.photos.every((p) => !p.overlap)).toBe(true);
  });
});

describe('другая песня — другой ритм', () => {
  it('тот же вход с медленной тихой песней', () => {
    const base = fixture('047');
    const slow: DayInput = {
      ...base,
      song: song({ bpm: 70, energy: 0.28, year: 2004, genre: 'Classical' }),
    };
    const a = buildDaySpec(base);
    const b = buildDaySpec(slow);
    expect(b.rhythm).not.toEqual(a.rhythm);
    expect(b.rhythm.beatsPerFold).toBe(8);
    expect(b.reveal).not.toEqual(a.reveal);
    expect(b.paper.grain).not.toBe(a.paper.grain);
    expect(b.mode).not.toBe(a.mode);
    // текст и фото те же
    expect(b.key).toEqual(a.key);
    expect(b.folds).toEqual(a.folds);
    expect(b.photos).toEqual(a.photos);
  });
});

describe('текст', () => {
  it('делит на предложения, не ломая тире и многоточие перед маленькой буквой', () => {
    expect(splitSentences('Бежали. Опоздали. А потом — два стакана на чемодане.')).toEqual([
      'Бежали.',
      'Опоздали.',
      'А потом — два стакана на чемодане.',
    ]);
    expect(splitSentences('Шли… и шли дальше. Потом сели!')).toEqual([
      'Шли… и шли дальше.',
      'Потом сели!',
    ]);
    expect(splitSentences('Вдруг... Дождь.')).toEqual(['Вдруг...', 'Дождь.']);
    expect(splitSentences('Первая строка\nВторая строка')).toEqual([
      'Первая строка',
      'Вторая строка',
    ]);
  });

  it('текст вообще без знаков делится на части', () => {
    const t =
      'норм день пары потом обед в столовой после этого долго шли пешком домой и болтали обо всём на свете';
    const parts = splitSentences(t);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(' ')).toBe(t);
  });

  it('«но» после коротких фраз даёт разворот', () => {
    const spec = buildDaySpec(day('Бежали. Но успели. Сели у окна.'));
    expect(spec.key.by).toBe('transition');
    expect(spec.key.transition).toBe('но');
    expect(spec.key.text.startsWith('успели')).toBe(true);
  });

  it('переход после длинных фраз не считается', () => {
    const long =
      'Мы долго собирались и ходили по магазинам в поисках подходящих подарков для всей семьи. ' +
      'Потом ещё час стояли в очереди на кассе и обсуждали, что приготовить на ужин в выходные. ' +
      'Но дома оказалось, что ничего не нужно.';
    expect(buildDaySpec(day(long)).key.by).not.toBe('transition');
  });

  it('без перехода главная — самая конкретная, при равенстве последняя', () => {
    const a = buildDaySpec(day('Были пары. Какао в термосе. Шли домой.'));
    expect(a.key.by).toBe('concrete');
    expect(a.key.text).toBe('Какао в термосе.');
    const b = buildDaySpec(day('Были пары. Потом дом. Потом сон.'));
    expect(b.key.by).toBe('last');
    expect(b.key.sentence).toBe(2);
  });

  it('автор выбирает главную фразу', () => {
    const spec = buildDaySpec(
      day('Бежали. Опоздали. А потом сели.', { overrides: { keySentence: 0 } }),
    );
    expect(spec.key.by).toBe('author');
    expect(spec.key.sentence).toBe(0);
    expect(spec.folds.map((f) => f.sentence)).toEqual([1, 2]);
    expect(spec.folds.every((f) => f.side === 'after')).toBe(true);
  });

  it('восклицание сужает складку', () => {
    const spec = buildDaySpec(day('Мы бежали по перрону! Мы бежали по перрону. Села в вагон.'));
    const [excl, plain] = spec.folds;
    expect(excl.width).toBeLessThan(plain.width);
  });

  it('длинные фразы шире рубленых', () => {
    const spec = buildDaySpec(
      day('Да. Нет. Утром очень долго и неторопливо сидели на кухне у большого окна. Конец.'),
    );
    const widths = spec.folds.map((f) => f.width);
    expect(Math.max(...widths)).toBe(spec.folds.find((f) => f.sentence === 2)?.width);
  });
});

describe('словарь основ', () => {
  it('находит словоформы по основе', () => {
    const w = (s: string) => findStems(s).map((h) => `${h.group}:${Math.sign(h.polarity)}`);
    expect(w('холодно')).toEqual(['temp:-1']);
    expect(w('холодина')).toEqual(['temp:-1']);
    expect(w('мы замёрзли')).toEqual(['temp:-1']);
    expect(w('замерзли')).toEqual(['temp:-1']);
    expect(w('тишина')).toEqual(['sound:-1']);
    expect(w('шумно')).toEqual(['sound:1']);
    expect(w('темнеет')).toEqual(['light:-1']);
    expect(w('закат')).toEqual(['light:1']);
    expect(w('лучше')).toEqual([]);
    expect(w('ветеран')).toEqual([]);
  });

  it('«Холодно, но пили какао»: холодные складки, тёплый разворот', () => {
    const spec = buildDaySpec(day('Холодно, но пили какао.'));
    expect(spec.paper.tone).toBeLessThan(0);
    expect(spec.paper.spreadTone).toBeGreaterThan(0);
    expect(spec.why.some((w) => w.param === 'paper.spreadTone' && w.text.includes('какао'))).toBe(
      true,
    );
  });

  it('мороз в складках, какао в главной фразе', () => {
    const spec = buildDaySpec(day('Мороз и ветер. Шли быстро. А потом какао и плед.'));
    expect(spec.paper.tone).toBeLessThan(-0.3);
    expect(spec.paper.spreadTone).toBeGreaterThan(0.3);
  });

  it('свет задаёт яркость и тени, звук — поля', () => {
    const bright = buildDaySpec(day('Солнце, яркий свет на закате.'));
    const dark = buildDaySpec(day('Темно, ночь, одни фонари.'));
    expect(bright.paper.brightness).toBeGreaterThan(dark.paper.brightness);
    expect(dark.paper.shadow).toBeGreaterThan(bright.paper.shadow);
    const quiet = buildDaySpec(day('Тишина. Тихо.'));
    const loud = buildDaySpec(day('Шум и толпа. Крик.'));
    expect(quiet.paper.margin).toBeGreaterThan(loud.paper.margin);
  });

  it('возраст: год песни и «как раньше»', () => {
    const old = buildDaySpec(day('Двор и детство.', { song: song({ year: 1985 }) }));
    const fresh = buildDaySpec(day('Обычный день.', { song: song({ year: 2020 }) }));
    expect(old.paper.age).toBeGreaterThan(0.6);
    expect(fresh.paper.age).toBe(0);
  });
});

describe('фото', () => {
  it('раскладка по числу снимков', () => {
    const photos = (n: number) => Array.from({ length: n }, (_, i) => photo(`p${i}`));
    expect(buildDaySpec(day('Утро.', { photos: photos(1) })).layout).toBe('window');
    expect(buildDaySpec(day('Утро.', { photos: photos(2) })).layout).toBe('diptych');
    expect(buildDaySpec(day('Утро.', { photos: photos(3) })).layout).toBe('contact');
    expect(buildDaySpec(day('Утро.', { photos: photos(5) })).layout).toBe('contact');
  });

  it('внахлёст: «мы», «вместе», имена; раздельно: «один»', () => {
    const o = (t: string) => buildDaySpec(day(t)).photos[0].overlap;
    expect(o('Мы пили чай.')).toBe(true);
    expect(o('Весь день вместе.')).toBe(true);
    expect(o('Потом пришла Аня.')).toBe(true);
    expect(o('Весь день один.')).toBe(false);
    expect(o('Просто день.')).toBe(false);
  });

  it('главный кадр: выбор автора, иначе с точкой, иначе первый', () => {
    const photos = [photo('a'), photo('b', { focus: { x: 0.9, y: 0.1 } }), photo('c')];
    const key = (extra: Partial<DayInput> = {}) =>
      buildDaySpec(day('День.', { photos, ...extra })).photos.find((p) => p.role === 'key');
    expect(key()?.photoId).toBe('b');
    expect(key({ overrides: { keyPhotoId: 'c' } })?.photoId).toBe('c');
    expect(buildDaySpec(day('День.', { photos: [photo('a'), photo('c')] })).photos[0].role).toBe(
      'key',
    );
  });

  it('фрагмент вокруг точки остаётся в кадре', () => {
    const corner = buildDaySpec(day('День.', { photos: [photo('a', { focus: { x: 1, y: 0 } })] }))
      .photos[0].crop;
    expect(corner.x + corner.w).toBeCloseTo(1);
    expect(corner.y).toBe(0);
    const mid = buildDaySpec(day('День.', { photos: [photo('a', { focus: { x: 0.5, y: 0.5 } })] }))
      .photos[0].crop;
    expect(mid.x + mid.w / 2).toBeCloseTo(0.5);
  });

  it('краска подписей: выраженный цвет с контрастом не меньше 4,5:1', () => {
    for (const palette of [
      ['#f7d296', '#f3ede3', '#e8e8e8'],
      ['#ff3366', '#eeeeee', '#111111'],
      ['#cccccc', '#bbbbbb', '#aaaaaa'],
      ['#ffffff', '#fefefe', '#fdfdfd'],
    ]) {
      expect(contrast(pickInk(palette), '#f3efe6')).toBeGreaterThanOrEqual(4.5);
    }
    // выбран цвет с наибольшей насыщенностью, а не первый серый
    expect(pickInk(['#999999', '#2255cc', '#cccccc']).startsWith('#')).toBe(true);
    const ink = pickInk(['#999999', '#2255cc']);
    const n = parseInt(ink.slice(1), 16);
    expect(n & 255).toBeGreaterThan((n >> 16) & 255);
  });

  it('duo: тени темнее светов', () => {
    const spec = buildDaySpec(fixture('047'));
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16);
    expect(lum(spec.duo[0])).toBeLessThan(lum(spec.duo[1]));
    expect(spec.duo[0]).toBe('#5a2318');
  });
});

describe('музыка и режим', () => {
  it('темп: от 110 ударов складка на 4 доли, иначе на 8', () => {
    const bpm = (n: number) => buildDaySpec(day('День.', { song: song({ bpm: n }) })).rhythm;
    expect(bpm(110).beatsPerFold).toBe(4);
    expect(bpm(109).beatsPerFold).toBe(8);
    expect(bpm(60).beatsPerFold).toBe(8);
  });

  it('энергия задаёт густоту полос и зерно', () => {
    const e = (n: number) => buildDaySpec(day('День.', { song: song({ energy: n }) }));
    expect(e(0.9).rhythm.density).toBeGreaterThan(e(0.2).rhythm.density);
    expect(e(0.9).paper.grain).toBeGreaterThan(e(0.2).paper.grain);
  });

  it('раскрытие: пик из признаков, звук стартует за ~4 с, не раньше нуля', () => {
    const early = song();
    if (early.features) early.features.peakSec = 2;
    const a = buildDaySpec(day('День.', { song: early }));
    expect(a.reveal.peakSec).toBe(2);
    expect(a.reveal.prerollSec).toBe(2);
    const b = buildDaySpec(day('День.', { song: song() }));
    expect(b.reveal.peakSec).toBe(15);
    expect(b.reveal.prerollSec).toBe(4);
    const beats = song();
    if (beats.features) beats.features.beats = [0.5, 1, 1.5];
    expect(buildDaySpec(day('День.', { song: beats })).reveal.beats).toEqual([0.5, 1, 1.5]);
  });

  it('длительность раскрытия — доли песни в разумных пределах', () => {
    const d = (bpm: number) =>
      buildDaySpec(day('День.', { song: song({ bpm }) })).reveal.durationMs;
    expect(d(120)).toBe(2000);
    expect(d(40)).toBeLessThanOrEqual(4000);
    expect(d(300)).toBeGreaterThanOrEqual(1200);
  });

  it('без песни: нейтрально, пик null и строка об этом в why', () => {
    const spec = buildDaySpec(day('Просто день.', { song: null }));
    expect(spec.song).toBeNull();
    expect(spec.reveal.peakSec).toBeNull();
    expect(spec.reveal.beats).toEqual([]);
    expect(spec.why.some((w) => w.text.includes('Песни нет'))).toBe(true);
    checkInvariants(spec);
  });

  it('режимы: плёнка, двухцветный, тихий, тёплый', () => {
    const m = (text: string, s: SongInput | null) => buildDaySpec(day(text, { song: s })).mode;
    expect(m('Обычный день на работе, много дел и встреч.', song({ year: 1975 }))).toBe('film');
    expect(m('Был двор, как раньше.', song({ year: 2018 }))).toBe('film');
    expect(m('Бежали. Опоздали! Спешка!', song({ bpm: 140, energy: 0.9 }))).toBe('duotone');
    expect(m('Тишина. Один дома.', song({ bpm: 60, energy: 0.2 }))).toBe('quiet');
    expect(
      m(
        'Вечером пили какао под пледом, потом читали вслух длинную книжку до самой ночи.',
        song({ bpm: 80, energy: 0.4 }),
      ),
    ).toBe('warm');
  });

  it('жанр — мягкий вес, не решает один', () => {
    const rock = song({ bpm: 90, energy: 0.5, genre: 'Rock' });
    const spec = buildDaySpec(
      day('Обычный длинный день с делами, звонками, встречами и дорогой домой.', { song: rock }),
    );
    expect(spec.mode).not.toBe('film');
  });
});

describe('название папки', () => {
  it('деталь без перехода, тире и точки, с заглавной', () => {
    expect(buildDaySpec(day('Бежали. А потом — два стакана на чемодане.')).folderName).toBe(
      'Два стакана на чемодане',
    );
  });

  it('очень короткая запись — шаблон по группе слов', () => {
    expect(buildDaySpec(day('Тихо.')).folderName).toBe('День, когда было тихо');
    expect(buildDaySpec(day('Холодно.')).folderName).toBe('День, когда было холодно');
    expect(buildDaySpec(day('Светло.')).folderName).toBe('День, когда было светло');
    expect(buildDaySpec(day('Ок.')).folderName).toBe('День без лишних слов');
  });

  it('длинная фраза урезается до 7 слов', () => {
    const spec = buildDaySpec(
      day(
        'Мы шли по длинной набережной вдоль реки до самого вечера и никуда не торопились совсем.',
      ),
    );
    expect(spec.folderName.split(/\s+/).length).toBeLessThanOrEqual(7);
    expect(spec.folderName.split(/\s+/).length).toBeGreaterThanOrEqual(3);
  });

  it('оценки в название не попадают', () => {
    const name = buildDaySpec(day('Это был очень хороший вечер у друзей.')).folderName;
    expect(name.toLowerCase()).not.toContain('очень');
    expect(name.toLowerCase()).not.toContain('хороший');
  });

  it('название автора побеждает', () => {
    expect(
      buildDaySpec(day('Тихо.', { overrides: { folderName: 'Моё название' } })).folderName,
    ).toBe('Моё название');
  });
});

describe('why', () => {
  it('говорит конкретной причиной, а не общими словами', () => {
    const spec = buildDaySpec(fixture('047'));
    const texts = spec.why.map((w) => w.text);
    expect(texts).toContain('Складки тесные: песня быстрая, около 123 ударов в минуту');
    expect(spec.why.find((w) => w.param === 'rhythm.beatsPerFold')).toBeDefined();
  });

  it('тёплая бумага называет слова из записи', () => {
    const spec = buildDaySpec(day('Мороз и ветер. Шли быстро. А потом какао и плед.'));
    const line = spec.why.find((w) => w.param === 'paper.spreadTone');
    expect(line?.text).toContain('«какао»');
    expect(line?.text).toContain('«плед»');
  });
});

describe('края', () => {
  it('1 и 5 фото', () => {
    for (const n of [1, 5]) {
      const photos = Array.from({ length: n }, (_, i) => photo(`p${i}`));
      const spec = buildDaySpec(day('Пришли. Сели. Чай.', { photos }));
      expect(spec.photos).toHaveLength(n);
      checkInvariants(spec);
    }
    expect(buildDaySpec(day('Мы вместе.', { photos: [photo('x')] })).photos[0].overlap).toBe(false);
  });

  it('одно предложение', () => {
    const spec = buildDaySpec(day('Просто один длинный день на работе без событий.'));
    expect(spec.folds).toEqual([]);
    expect(spec.key.sentence).toBe(0);
    checkInvariants(spec);
  });

  it('15 предложений', () => {
    const text = Array.from({ length: 15 }, (_, i) => `Фраза номер ${i + 1} про день.`).join(' ');
    const spec = buildDaySpec(day(text));
    expect(spec.folds).toHaveLength(14);
    expect(spec.folds.map((f) => f.sentence)).not.toContain(spec.key.sentence);
    checkInvariants(spec);
  });

  it('текст без знаков препинания', () => {
    const text =
      'встали рано поехали на вокзал потом долго ждали поезд и пили чай из термоса а потом наконец поехали домой уставшие но довольные';
    const spec = buildDaySpec(day(text));
    expect(spec.folds.length).toBeGreaterThan(0);
    checkInvariants(spec);
  });

  it('странный вход: пустой текст, пустая палитра, нет признаков песни', () => {
    const weird: DayInput = {
      date: '2026-11-20',
      number: 3,
      text: '   ',
      photos: [photo('a', { palette: [] })],
      song: song({ features: null, year: null }),
    };
    const spec = buildDaySpec(weird);
    expect(spec.folds).toEqual([]);
    checkInvariants(spec);
  });

  it('id дня', () => {
    expect(dayId('2026-11-20', 7)).toBe('2026-11-20-007');
    expect(buildDaySpec(day('День.', { number: 12 })).id).toBe('2026-11-20-012');
  });

  it('песня в DaySpec — только ссылки', () => {
    const spec = buildDaySpec(fixture('047'));
    expect(spec.song).toMatchObject({ trackId: 697195787, year: 2001, previewUrl: null });
  });
});

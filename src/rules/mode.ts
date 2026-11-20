/**
 * Режим обработки фото по таблице приёмов из docs/rules.md.
 * Каждый режим набирает очки по признакам дня; побеждает больший счёт, при равенстве —
 * плёнка, затем двухцветный, затем тихий, затем тёплый. Жанр даёт мягкий вес: он неточен.
 */
import type { PhotoMode, SongInput, WhyLine } from '../types/dayspec';
import { groupHits, wordsOf } from './stems';
import type { TextRules } from './text';
import { beatsPhrase, quoteList } from './util';

const ORDER: PhotoMode[] = ['film', 'duotone', 'quiet', 'warm'];
const NAME: Record<PhotoMode, string> = {
  film: 'плёнка',
  duotone: 'двухцветный',
  quiet: 'тихий светлый',
  warm: 'тёплый свет',
};
/** Ниже этого счёта ни один приём не набрал силы, остаётся тёплый по умолчанию. */
const MIN_SCORE = 1.5;
const SHORT_TEXT_WORDS = 12;

const GENRES: Record<PhotoMode, RegExp> = {
  film: /oldies|retro|ретро/,
  duotone:
    /rock|metal|punk|dance|electronic|hip-hop|rap|techno|house|рок|метал|танц|электрон|хип|рэп/,
  quiet: /classical|ambient|new age|piano|instrumental|класси|амбиент|фортепиан/,
  warm: /jazz|acoustic|folk|singer|soul|blues|bossa|джаз|фолк|акуст|соул|блюз/,
};

interface Entry {
  score: number;
  reasons: string[];
}

export function chooseMode(
  t: TextRules,
  song: SongInput | null,
): { mode: PhotoMode; why: WhyLine } {
  const f = song?.features ?? null;
  const bpm = f && Number.isFinite(f.bpm) && f.bpm > 0 ? f.bpm : null;
  const energy = f && Number.isFinite(f.energy) ? f.energy : null;
  const spread = f && Number.isFinite(f.energySpread) ? f.energySpread : null;
  const year = song?.year ?? null;
  const genre = (song?.genre ?? '').toLowerCase();

  const s: Record<PhotoMode, Entry> = {
    film: { score: 0, reasons: [] },
    duotone: { score: 0, reasons: [] },
    quiet: { score: 0, reasons: [] },
    warm: { score: 0, reasons: [] },
  };
  const add = (m: PhotoMode, score: number, reason?: string) => {
    s[m].score += score;
    if (reason) s[m].reasons.push(reason);
  };

  // плёнка: год песни и ностальгия
  if (year !== null && year < 2000) add('film', 3, `песня ${year} года`);
  if (t.nostalgia.length) add('film', 3, `в записи ${quoteList(t.nostalgia)}`);

  // двухцветный: высокая энергия, резкие удары, напряжённый текст
  if (energy !== null && energy > 0.7) add('duotone', 3, 'песня громкая и плотная');
  else if (energy !== null && energy > 0.55) add('duotone', 1.5, 'песня довольно энергичная');
  if (bpm !== null && bpm >= 120) add('duotone', 1, `быстрый темп, ${beatsPhrase(bpm)}`);
  if (spread !== null && spread >= 0.3) add('duotone', 1, 'в громкости песни резкие перепады');
  if (t.words > 0 && t.avgWords <= 3.5 && t.sentences.length >= 3) {
    add('duotone', 1, 'фразы рубленые');
  }
  if (t.exclamations >= 2) add('duotone', 1, 'в записи восклицания');
  if (t.tense.length) add('duotone', 1, `в записи ${quoteList(t.tense)}`);
  if (GENRES.duotone.test(genre)) add('duotone', 0.5);

  // тихий светлый: тихая песня, короткий текст, «один», «тишина»
  if (energy !== null && energy < 0.35) add('quiet', 3, 'песня тихая');
  else if (energy !== null && energy < 0.45) add('quiet', 1.5, 'песня негромкая');
  if (t.words > 0 && t.words <= SHORT_TEXT_WORDS) add('quiet', 1.5, 'запись короткая');
  const hush = wordsOf(groupHits(t.hits, 'sound'), (h) => h.polarity <= -0.8);
  if (hush.length) add('quiet', 2, `в записи ${quoteList(hush)}`);
  if (t.company.alone.length) add('quiet', 2, `в записи ${quoteList(t.company.alone)}`);
  if (GENRES.quiet.test(genre)) add('quiet', 0.5);

  // тёплый мягкий свет: тёплые слова, спокойная песня до ~100 ударов
  const warm = wordsOf(groupHits(t.hits, 'temp'), (h) => h.polarity > 0);
  if (warm.length) add('warm', Math.min(warm.length, 3), `в записи ${quoteList(warm)}`);
  if (bpm !== null && bpm <= 100) add('warm', 1.5, `песня спокойная, ${beatsPhrase(bpm)}`);
  if (energy !== null && energy <= 0.6) add('warm', 0.5);
  if (GENRES.warm.test(genre)) add('warm', 0.5);
  if (GENRES.film.test(genre)) add('film', 0.5);

  let mode: PhotoMode = 'warm';
  let best = -1;
  for (const m of ORDER) {
    if (s[m].score > best) {
      best = s[m].score;
      mode = m;
    }
  }
  if (best < MIN_SCORE) {
    return {
      mode: 'warm',
      why: {
        param: 'mode',
        text: `Режим снимков «${NAME.warm}»: ничто в дне не тянет к плёнке, контрасту или тишине, остаётся мягкий свет`,
      },
    };
  }

  const reasons = s[mode].reasons.slice(0, 3);
  return {
    mode,
    why: {
      param: 'mode',
      text: `Режим снимков «${NAME[mode]}»${reasons.length ? `: ${reasons.join(', ')}` : ''}`,
    },
  };
}

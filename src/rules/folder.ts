/**
 * Название папки: деталь из главной фразы, 3–7 слов, без перехода, тире, оценок и точки,
 * с заглавной. Для очень короткой записи — шаблон «День, когда было тихо».
 */
import type { WhyLine } from '../types/dayspec';
import { findStems, groupHits, score, type StemGroup } from './stems';
import type { TextRules } from './text';
import { capitalize, fold, rawWords } from './util';

export const MIN_NAME_WORDS = 3;
export const MAX_NAME_WORDS = 7;

const EVAL =
  /^(очень|просто|самый|самая|самое|самые|такой|такая|такое|такие|супер|круто|здорово|прекрасн|ужас|чудесн|замечательн|отличн|классн|лучш|худш|плох|хорош|красив|отвратительн|кошмарн|шикарн|идеальн|великолепн|потрясающ)/;
const LEAD_STOP = new Set('и а но же вот ну тут вдруг потом наконец'.split(' '));
const TAIL_STOP = new Set(
  'и а но в на с к у о по за из не что как же ли бы то от до для при про под над без'.split(' '),
);

const TEMPLATE_WORD: Record<StemGroup, [neg: string, pos: string]> = {
  sound: ['тихо', 'шумно'],
  temp: ['холодно', 'тепло'],
  light: ['темно', 'светло'],
};
const GROUP_TITLE: Record<StemGroup, string> = {
  sound: 'слов о звуке',
  temp: 'слов о тепле и холоде',
  light: 'слов о свете',
};
const NEUTRAL_NAME = 'День без лишних слов';

function cleanWords(text: string): string[] {
  const out = text
    .split(/\s+/)
    .map((w) => w.replace(/[«»"“”!?…]/g, '').replace(/[.;:]+$/, ''))
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .filter((w) => !EVAL.test(fold(w.replace(/[^\p{L}\p{N}-]/gu, ''))));
  while (out.length && LEAD_STOP.has(fold(out[0].replace(/,$/, '')))) out.shift();
  while (out.length && TAIL_STOP.has(fold(out[out.length - 1].replace(/,$/, '')))) out.pop();
  if (out.length) out[out.length - 1] = out[out.length - 1].replace(/,+$/, '');
  return out;
}

function detail(text: string): string[] {
  const words = cleanWords(text);
  if (words.length <= MAX_NAME_WORDS) return words;
  // длинная фраза: берём самую конкретную часть между запятыми, тире и двоеточиями
  const clauses = text
    .split(/\s*[;:—–]\s*|,\s+/)
    .map(cleanWords)
    .filter((c) => c.length >= MIN_NAME_WORDS && c.length <= MAX_NAME_WORDS);
  if (clauses.length) {
    let best = clauses[0];
    let bestScore = concrete(best);
    for (const c of clauses.slice(1)) {
      const sc = concrete(c);
      if (sc > bestScore) {
        best = c;
        bestScore = sc;
      }
    }
    return best;
  }
  const cut = words.slice(0, MAX_NAME_WORDS);
  while (cut.length && TAIL_STOP.has(fold(cut[cut.length - 1].replace(/,$/, '')))) cut.pop();
  if (cut.length) cut[cut.length - 1] = cut[cut.length - 1].replace(/,+$/, '');
  return cut;
}

function concrete(words: string[]): number {
  const text = words.join(' ');
  const names = rawWords(text).filter((w, i) => i > 0 && /^[А-ЯЁ][а-яё]+$/.test(w)).length;
  return findStems(text).length + names + (/\d/.test(text) ? 1 : 0);
}

function template(t: TextRules): { name: string; word: string; group: StemGroup } | null {
  let best: StemGroup | null = null;
  let bestAbs = 0;
  for (const g of ['sound', 'temp', 'light'] as const) {
    const abs = Math.abs(score(t.hits, g));
    if (groupHits(t.hits, g).length && abs > bestAbs) {
      best = g;
      bestAbs = abs;
    }
  }
  if (!best) return null;
  const word = TEMPLATE_WORD[best][score(t.hits, best) < 0 ? 0 : 1];
  return { name: `День, когда было ${word}`, word, group: best };
}

export function folderName(t: TextRules, override?: string): { name: string; why: WhyLine } {
  const own = override?.trim();
  if (own) {
    return { name: own, why: { param: 'folderName', text: 'Название папки задал автор' } };
  }
  const words = detail(t.key.text);
  if (words.length >= MIN_NAME_WORDS && words.length <= MAX_NAME_WORDS) {
    const name = capitalize(words.join(' '));
    return {
      name,
      why: { param: 'folderName', text: `Папка названа деталью из главной фразы: «${name}»` },
    };
  }
  const tpl = template(t);
  if (tpl) {
    return {
      name: tpl.name,
      why: {
        param: 'folderName',
        text: `Запись очень короткая, поэтому название по шаблону: слово «${tpl.word}» из ${GROUP_TITLE[tpl.group]}`,
      },
    };
  }
  return {
    name: NEUTRAL_NAME,
    why: {
      param: 'folderName',
      text: 'Запись очень короткая и без ярких слов, поэтому название по шаблону «День без лишних слов»',
    },
  };
}

/**
 * Правила текста: деление на предложения, переход, главная фраза, складки,
 * слова о близости, напряжении и «как раньше».
 */
import type { Fold, KeyPhrase, Overrides, WhyLine } from '../types/dayspec';
import { findStems, type StemHit } from './stems';
import { clamp, fold, lowerWords, quoteList, rawWords, round, sum, wordCount } from './util';

// ---------- Предложения ----------

const END = /[.!?…]+["»”')\]]*(?=\s+\S|\s*$)/g;
const HAS_LETTER = /[\p{L}\p{N}]/u;
const TERMINATED = /[.!?…]["»”')\]]*$/;
const MAX_UNPUNCTUATED = 14;
const CHUNK_WORDS = 9;

/**
 * Режет текст на предложения: по . ! ? …, по переносам строк. Многоточие перед маленькой
 * буквой предложение не обрывает. Длинный кусок вовсе без знаков делится по запятым и
 * словам-переходам, а если и так длинный — на ровные части.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split(/\n+/)) {
    const para = line.trim();
    if (!para) continue;
    for (const s of splitParagraph(para)) out.push(...chunkUnpunctuated(s));
  }
  return out.filter((s) => HAS_LETTER.test(s));
}

function splitParagraph(p: string): string[] {
  const res: string[] = [];
  let start = 0;
  for (const m of p.matchAll(END)) {
    const end = (m.index ?? 0) + m[0].length;
    const rest = p.slice(end).trimStart();
    const ellipsis = /…|\.{2,}/.test(m[0]);
    if (rest && ellipsis && /^[а-яёa-z]/.test(rest)) continue;
    res.push(p.slice(start, end).trim());
    start = end;
  }
  const tail = p.slice(start).trim();
  if (tail) res.push(tail);
  return res;
}

function chunkUnpunctuated(s: string): string[] {
  if (TERMINATED.test(s) || wordCount(s) <= MAX_UNPUNCTUATED) return [s];
  const pieces = s.split(
    /(?<=[,;])\s+|\s+(?=(?:а потом|а затем|и тут|и вдруг|вдруг|наконец|но)(?![\p{L}]))/iu,
  );
  const merged: string[] = [];
  for (const piece of pieces) {
    const last = merged[merged.length - 1];
    if (last !== undefined && wordCount(last) < 4) merged[merged.length - 1] = `${last} ${piece}`;
    else merged.push(piece);
  }
  const res: string[] = [];
  for (const piece of merged) {
    const clean = piece.replace(/[,;]+$/, '').trim();
    const ws = clean.split(/\s+/);
    if (ws.length <= MAX_UNPUNCTUATED) {
      res.push(clean);
      continue;
    }
    const parts = Math.ceil(ws.length / CHUNK_WORDS);
    const size = Math.ceil(ws.length / parts);
    for (let i = 0; i < ws.length; i += size) res.push(ws.slice(i, i + size).join(' '));
  }
  return res;
}

// ---------- Переходы ----------

const TRANSITIONS: Array<[phrase: string, weight: number]> = [
  ['а потом', 3],
  ['а затем', 2],
  ['и тут', 3],
  ['а тут', 2],
  ['и вдруг', 3],
  ['а вдруг', 3],
  ['вдруг', 3],
  ['наконец', 3],
  ['но', 1],
];
const TRANSITION_RE = new RegExp(
  `^[«"“\\s—–-]*(${TRANSITIONS.map(([p]) => p).join('|')})(?![\\p{L}])[\\s,:;—–-]*`,
  'iu',
);
/** Фразы до перехода «короткие», если в среднем не длиннее этого. */
const SHORT_AVG_WORDS = 8;

interface Turn {
  index: number;
  word: string;
  /** Предложение без слова-перехода и тире. */
  rest: string;
}

function parseTransition(sentence: string): { word: string; rest: string; weight: number } | null {
  const m = TRANSITION_RE.exec(sentence);
  if (!m) return null;
  const word = m[1].toLowerCase();
  const rest = sentence.slice(m[0].length).trim();
  if (!HAS_LETTER.test(rest)) return null;
  const weight = TRANSITIONS.find(([p]) => p === word)?.[1] ?? 1;
  return { word, rest, weight };
}

function findTurn(sentences: string[]): Turn | null {
  let best: (Turn & { weight: number }) | null = null;
  for (let index = 1; index < sentences.length; index++) {
    const t = parseTransition(sentences[index]);
    if (!t) continue;
    const before = sentences.slice(0, index).map(wordCount);
    if (sum(before) / before.length > SHORT_AVG_WORDS) continue;
    if (!best || t.weight >= best.weight) {
      best = { index, word: t.word, rest: t.rest, weight: t.weight };
    }
  }
  return best;
}

// ---------- Конкретность ----------

const NUMERALS = new Set(
  (
    'один одна одно одну одной одного одним два две двух двум двумя три трех трем тремя четыре четырех ' +
    'пять пяти шесть шести семь семи восемь девять десять двадцать тридцать сорок сто сотня тысяча'
  ).split(' '),
);
const WE = new Set('мы нас нам нами наш наша наше наши нашей нашу вместе вдвоем втроем'.split(' '));
const NEAR = new Set(['рядом']);
const ALONE = /^(один|одна|одни|одинок|одиноч|никого)/;
const TENSE = [
  'бежал',
  'бежим',
  'бегом',
  'опозд',
  'паник',
  'тревог',
  'нервн',
  'срочн',
  'ссор',
  'ругал',
  'спешк',
  'гонк',
  'страшн',
  'боял',
  'сует',
  'давк',
  'толкотн',
];
const NOSTALGIA =
  /как раньше|как в детстве|детств|во дворе|двор(?:а|у|е|ом|ы|ов)?(?![\p{L}])|ностальг/giu;

export interface Company {
  we: string[];
  names: string[];
  near: string[];
  alone: string[];
}

/** «Мы», «вместе», имена (слово с заглавной не в начале фразы), «рядом», «один». */
export function findCompany(text: string): Company {
  const we: string[] = [];
  const near: string[] = [];
  const alone: string[] = [];
  const names: string[] = [];
  for (const sentence of splitSentences(text)) {
    rawWords(sentence).forEach((w, i) => {
      const f = fold(w);
      if (WE.has(f)) we.push(f);
      if (NEAR.has(f)) near.push(f);
      if (ALONE.test(f)) alone.push(f);
      if (i > 0 && /^[А-ЯЁ][а-яё]+$/.test(w)) names.push(w);
    });
  }
  return { we, names, near, alone };
}

export function findNostalgia(text: string): string[] {
  return (text.toLowerCase().match(NOSTALGIA) ?? []).map((w) => w.trim());
}

export function findTense(text: string): string[] {
  return rawWords(text)
    .map((w) => w.toLowerCase())
    .filter((w) => TENSE.some((t) => fold(w).startsWith(t)));
}

interface Concrete {
  score: number;
  reasons: string[];
}

function concreteness(sentence: string): Concrete {
  const reasons: string[] = [];
  const hits = findStems(sentence);
  if (hits.length) reasons.push(...new Set(hits.map((h) => h.word)));
  const toks = lowerWords(sentence);
  const num = toks.find((t) => NUMERALS.has(t)) ?? sentence.match(/\d+/)?.[0];
  if (num) reasons.push(num);
  const co = findCompany(sentence);
  if (co.names.length) reasons.push(co.names[0]);
  if (co.we.length) reasons.push(co.we[0]);
  const n = new Set(reasons).size;
  // одно слово — состояние, а не деталь: весит вдвое меньше
  return { score: toks.length <= 1 ? n / 2 : n, reasons };
}

// ---------- Главная фраза и складки ----------

export interface TextRules {
  sentences: string[];
  key: KeyPhrase;
  /** Слова, по которым выбрана главная фраза. */
  keyReasons: string[];
  folds: Fold[];
  hits: StemHit[];
  keyHits: StemHit[];
  /** Часть главной фразы до «но» (для холодных складок и тёплого разворота). */
  keyBefore: string;
  /** Часть главной фразы после «но»; без «но» — вся фраза. */
  keyAfter: string;
  company: Company;
  nostalgia: string[];
  tense: string[];
  words: number;
  avgWords: number;
  exclamations: number;
  why: WhyLine[];
}

export function analyzeText(text: string, overrides?: Overrides): TextRules {
  const sentences = splitSentences(text);
  const why: WhyLine[] = [];
  const author = overrides?.keySentence;
  const authorOk =
    author !== undefined && Number.isInteger(author) && author >= 0 && author < sentences.length;

  let key: KeyPhrase;
  let keyReasons: string[] = [];
  if (sentences.length === 0) {
    key = { text: text.trim(), sentence: 0, by: 'last' };
  } else if (authorOk) {
    key = { text: sentences[author], sentence: author, by: 'author' };
    why.push({ param: 'key', text: 'Главную фразу выбрал автор: правила её не трогают' });
  } else {
    const turn = findTurn(sentences);
    if (turn) {
      key = { text: turn.rest, sentence: turn.index, by: 'transition', transition: turn.word };
      const prev = sentences.slice(0, turn.index);
      why.push({
        param: 'key',
        text:
          `Главная фраза после перехода «${turn.word}»: ` +
          (prev.length === 1
            ? 'перед ним фраза короткая, она сужена в складку'
            : 'перед ним фразы короткие, они сужены в складки') +
          ', а день повернулся на этой фразе',
      });
    } else {
      const scores = sentences.map((s) => concreteness(s));
      const max = Math.max(...scores.map((c) => c.score));
      const ties = scores.filter((c) => c.score === max).length;
      let idx = scores.length - 1;
      scores.forEach((c, i) => {
        if (c.score === max) idx = i;
      });
      keyReasons = scores[idx].reasons;
      if (max === 0) {
        key = { text: sentences[idx], sentence: idx, by: 'last' };
        why.push({
          param: 'key',
          text: 'Главная фраза последняя: переходов и ярких деталей в записи нет, а конец дня запоминается',
        });
      } else if (ties > 1) {
        key = { text: sentences[idx], sentence: idx, by: 'last' };
        why.push({
          param: 'key',
          text: `Главная фраза последняя: в ${ties === 2 ? 'двух фразах' : `${ties} фразах`} деталей поровну, при равенстве берём последнюю`,
        });
      } else {
        key = { text: sentences[idx], sentence: idx, by: 'concrete' };
        why.push({
          param: 'key',
          text: `Главная фраза самая конкретная: в ней ${quoteList(keyReasons)}`,
        });
      }
    }
  }

  const avgWords = sentences.length ? sum(sentences.map(wordCount)) / sentences.length : 0;
  const exclamations = sentences.filter((s) => /!["»”')\]]*$/.test(s)).length;
  const folds = buildFolds(sentences, key);

  if (folds.length > 0) {
    if (avgWords <= 3.5 && sentences.length >= 3) {
      why.push({
        param: 'folds.width',
        text: `Складки узкие и частые: фразы рубленые, в каждой около ${wordsPhrase(avgWords)}`,
      });
    } else if (avgWords >= 9) {
      why.push({
        param: 'folds.width',
        text: `Складки широкие: фразы длинные, в каждой около ${wordsPhrase(avgWords)}`,
      });
    }
    if (exclamations > 0) {
      why.push({
        param: 'folds.width',
        text: 'Складки с восклицаниями ещё уже: резкая фраза занимает мало места',
      });
    }
  }

  const keyText = key.text;
  const keyHits = findStems(keyText);
  const split = /^(.*?),?\s+но\s+(.+)$/isu.exec(keyText);
  return {
    sentences,
    key,
    keyReasons,
    folds,
    hits: findStems(text),
    keyHits,
    keyBefore: split ? split[1] : '',
    keyAfter: split ? split[2] : keyText,
    company: findCompany(text),
    nostalgia: findNostalgia(text),
    tense: findTense(text),
    words: wordCount(text),
    avgWords,
    exclamations,
    why,
  };
}

function wordsPhrase(avg: number): string {
  const n = Math.max(1, Math.round(avg));
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'слова' : 'слов'}`;
}

/** Ширина складки: чем длиннее фраза, тем шире; восклицание и фразы до перехода — уже. */
export function foldWidth(sentence: string, beforeTurn: boolean): number {
  const words = Math.min(wordCount(sentence), 12);
  let w = 0.07 + 0.025 * words;
  if (/!["»”')\]]*$/.test(sentence)) w *= 0.75;
  if (beforeTurn) w *= 0.85;
  return round(clamp(w, 0.05, 0.32));
}

function buildFolds(sentences: string[], key: KeyPhrase): Fold[] {
  const folds: Fold[] = [];
  sentences.forEach((text, sentence) => {
    if (sentence === key.sentence) return;
    const before = sentence < key.sentence;
    folds.push({
      text,
      sentence,
      width: foldWidth(text, before && key.by === 'transition'),
      side: before ? 'before' : 'after',
    });
  });
  return folds;
}

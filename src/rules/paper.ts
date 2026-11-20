/**
 * Правила бумаги: тон складок и разворота (тепло/холод), яркость и тени (свет),
 * поля (звук), старение (год песни, «как раньше»), тон от светлоты снимков.
 */
import type { Paper, PhotoInput, WhyLine } from '../types/dayspec';
import { findStems, groupHits, score, wordsOf } from './stems';
import type { TextRules } from './text';
import { clamp, quoteList, round, sum } from './util';

const TEMP_NAME = (v: number) => (v < 0 ? 'холодные' : 'тёплые');

export interface PaperRules {
  paper: Omit<Paper, 'grain'>;
  why: WhyLine[];
}

export function paperRules(
  t: TextRules,
  photos: PhotoInput[],
  songYear: number | null,
): PaperRules {
  const why: WhyLine[] = [];

  // --- тепло и холод: складки и разворот считаются отдельно
  const foldHits = groupHits(findStems(t.folds.map((f) => f.text).join(' ')), 'temp');
  const beforeHits = t.keyBefore ? groupHits(findStems(t.keyBefore), 'temp') : [];
  const spreadHits = groupHits(findStems(t.keyAfter), 'temp');

  let tone = 0;
  let toneWords: string[] = [];
  let toneWhere = '';
  if (foldHits.length) {
    tone = clamp(score(foldHits, 'temp') * 0.5, -1, 1);
    toneWords = wordsOf(foldHits);
    toneWhere = 'в записи';
  } else if (beforeHits.length) {
    tone = clamp(score(beforeHits, 'temp') * 0.5, -1, 1);
    toneWords = wordsOf(beforeHits);
    toneWhere = 'до «но» в той же фразе';
  }
  let spreadTone = spreadHits.length ? clamp(score(spreadHits, 'temp') * 0.6, -1, 1) : tone;
  if (!foldHits.length && !beforeHits.length && spreadHits.length) tone = round(spreadTone * 0.6);
  if (Math.abs(tone) < 0.05) tone = 0;
  if (Math.abs(spreadTone) < 0.05) spreadTone = 0;

  if (toneWords.length && Math.abs(tone) >= 0.2) {
    why.push({
      param: 'paper.tone',
      text: `Складки ${TEMP_NAME(tone)}: ${toneWhere} ${quoteList(toneWords)}`,
    });
  }
  if (spreadHits.length && Math.abs(spreadTone) >= 0.2) {
    const contrast = tone !== 0 && Math.sign(tone) !== Math.sign(spreadTone);
    why.push({
      param: 'paper.spreadTone',
      text:
        `Разворот ${spreadTone < 0 ? 'холодный' : 'тёплый'}: в главной фразе ${quoteList(wordsOf(spreadHits))}` +
        (contrast ? `, а складки ${TEMP_NAME(tone)}: контраст вместо среднего цвета` : ''),
    });
  }

  // --- свет: яркость и тени
  const light = groupHits(t.hits, 'light');
  const lightScore = clamp(score(t.hits, 'light'), -3, 3);
  const dark = Math.min(3, -sum(light.filter((h) => h.polarity < 0).map((h) => h.polarity)));
  const bright = Math.min(3, sum(light.filter((h) => h.polarity > 0).map((h) => h.polarity)));
  let brightness = 0.55 + 0.14 * lightScore;
  const shadow = light.length ? 0.4 + 0.15 * dark - 0.08 * bright : 0.4;
  if (light.length && Math.abs(lightScore) >= 0.3) {
    const dim = lightScore < 0;
    why.push({
      param: 'paper.brightness',
      text: `Бумага ${dim ? 'темнее' : 'ярче'}: в записи ${quoteList(wordsOf(light))}`,
    });
    why.push({
      param: 'paper.shadow',
      text: `Тени на сгибах ${dim ? 'глубже' : 'мягче'}: ${dim ? 'свет в записи скуп' : 'в записи много света'}`,
    });
  }

  // --- светлота снимков слегка тонирует бумагу
  if (photos.length) {
    const avg = sum(photos.map((p) => p.lightness)) / photos.length;
    const shift = (avg - 0.45) * 0.2;
    if (Math.abs(shift) >= 0.02) {
      brightness += shift;
      why.push({
        param: 'paper.brightness',
        text: `Бумага чуть ${shift > 0 ? 'светлее' : 'темнее'}: снимки в среднем ${shift > 0 ? 'светлые' : 'тёмные'}`,
      });
    }
  }

  // --- звук: поля
  const sound = groupHits(t.hits, 'sound');
  const soundScore = clamp(score(t.hits, 'sound'), -3, 3);
  const margin = clamp(0.35 - 0.12 * soundScore, 0.1, 0.85);
  if (sound.length && Math.abs(soundScore) >= 0.3) {
    why.push({
      param: 'paper.margin',
      text:
        soundScore < 0
          ? `Поля шире: в записи ${quoteList(wordsOf(sound))}, а тишина передаётся пустой бумагой`
          : `Поля уже: в записи ${quoteList(wordsOf(sound))}, шум занимает место`,
    });
  }

  // --- возраст: год песни и «как раньше»
  let age = 0;
  const reasons: string[] = [];
  if (songYear !== null && songYear < 2000) {
    age += clamp(0.4 + (2000 - songYear) * 0.01, 0.4, 0.8);
    reasons.push(`песня ${songYear} года`);
  } else if (songYear !== null && songYear < 2010) {
    age += 0.1;
  }
  if (t.nostalgia.length) {
    age += 0.25;
    reasons.push(`в записи ${quoteList(t.nostalgia)}`);
  }
  age = clamp(age, 0, 1);
  if (reasons.length) {
    why.push({ param: 'paper.age', text: `Бумага старше: ${reasons.join(' и ')}` });
  }

  return {
    paper: {
      tone: round(tone),
      spreadTone: round(spreadTone),
      brightness: round(clamp(brightness, 0.1, 0.95)),
      shadow: round(clamp(shadow, 0.1, 0.9)),
      margin: round(margin),
      age: round(age),
    },
    why,
  };
}

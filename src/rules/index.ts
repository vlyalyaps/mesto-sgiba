/**
 * Правила дня: чистая функция DayInput → DaySpec. Правила описаны в docs/rules.md.
 * Без Date, случайности, сети и DOM: один и тот же день всегда даёт одну и ту же книжку.
 */
import type { DayInput, DaySpec, SongRef } from '../types/dayspec';
import { buildPage } from './page';
import { folderName } from './folder';
import { chooseMode } from './mode';
import { musicRules } from './music';
import { paperRules } from './paper';
import { photoRules } from './photo';
import { analyzeText } from './text';
import { isReference047, heartTrigger } from './reference047';
import { selectAlphabets } from './titleLetters';

/** 'YYYY-MM-DD-NNN': один id для DaySpec, архива и ссылки #/day/…. */
export function dayId(date: string, number: number): string {
  return `${date}-${String(number).padStart(3, '0')}`;
}

export function buildDaySpec(input: DayInput): DaySpec {
  const text = analyzeText(input.text, input.overrides);
  const photo = photoRules(input.photos, text.company, input.overrides);
  const paper = paperRules(text, input.photos, input.song?.year ?? null);
  const music = musicRules(input.song);
  const mode = chooseMode(text, input.song);
  const folder = folderName(text, input.overrides?.folderName);

  const id = dayId(input.date, input.number);
  const { page, why: pageWhy } = buildPage(
    input,
    {
      id,
      photos: photo.photos,
      mode: mode.mode,
      ink: photo.ink,
      duo: photo.duo,
      reveal: music.reveal,
    },
    text,
  );
  if (isReference047({ id, folderName: folder.name, photos: photo.photos })) {
    const lettering = selectAlphabets(input.song);
    page.titleAlphabets = lettering.alphabets;
    pageWhy.push(
      lettering.why,
      {
        param: 'page.reference.prints',
        text: 'Два разных снимка — два отпечатка. Рядом с перроном вклеен чек на два чая.',
      },
      {
        param: 'page.reference.tea',
        text: 'Два стакана остаются в крупном кадре. На полях — след кружки и рисунок подстаканника.',
      },
    );
    if (input.mood === 'restless')
      pageWhy.push({
        param: 'page.reference.mood',
        text: 'Автор отметил тревогу. На полях остались каракули, зачёркнутое «успеть», жирная стрелка и рваная изолента.',
      });
    const word = heartTrigger(input.text);
    if (word)
      pageWhy.push({
        param: 'page.reference.heart',
        text: `Слово «${word}» оставило одно маленькое сердце у записи.`,
      });
  }
  return {
    v: 1,
    page,
    id,
    date: input.date,
    number: input.number,
    folderName: folder.name,
    key: text.key,
    folds: text.folds,
    photos: photo.photos,
    layout: photo.layout,
    mode: mode.mode,
    paper: { ...paper.paper, grain: music.grain },
    ink: photo.ink,
    duo: photo.duo,
    rhythm: music.rhythm,
    reveal: music.reveal,
    song: input.song ? songRef(input.song) : null,
    why: [...text.why, ...paper.why, ...photo.why, mode.why, ...music.why, folder.why, ...pageWhy],
  };
}

function songRef(s: NonNullable<DayInput['song']>): SongRef {
  return {
    trackId: s.trackId,
    title: s.title,
    artist: s.artist,
    trackViewUrl: s.trackViewUrl,
    previewUrl: s.previewUrl,
    artworkUrl: s.artworkUrl,
    year: s.year,
  };
}

import type { CutAlphabet, SongInput, WhyLine } from '../types/dayspec';
import { seeded } from './util';

const names: Record<CutAlphabet, string> = {
  news: 'газета',
  gloss: 'глянец',
  book: 'книжная антиква',
  typewriter: 'машинка',
  stencil: 'трафарет',
  emboss: 'тиснёная лента',
  kraft: 'крафтовая бирка',
  xerox: 'ксерокопия',
  neon: 'неоновая вывеска',
  note: 'рукописная записка',
  pixel: 'пиксельная печать',
};
export function selectAlphabets(song: Pick<SongInput, 'genre' | 'year'> | null) {
  const genre = song?.genre?.trim() ?? '',
    year = song?.year;
  let byGenre: CutAlphabet[];
  if (/classical|orchestral|piano|классик|классич|фортепиан/iu.test(genre))
    byGenre = ['book', 'typewriter'];
  else if (/rock|metal|punk|рок|панк|метал/iu.test(genre)) byGenre = ['news', 'xerox', 'stencil'];
  else if (/electr|dance|techno|house|электр|танц|техно|хаус/iu.test(genre))
    byGenre = ['emboss', 'pixel'];
  else if (/pop|поп/iu.test(genre)) byGenre = ['gloss', 'neon'];
  else byGenre = ['kraft', 'note'];
  const era: CutAlphabet[] =
    year == null
      ? ['news']
      : year < 2000
        ? ['news', 'xerox', 'stencil']
        : year < 2010
          ? byGenre.includes('book')
            ? ['news']
            : ['gloss', 'news', 'xerox']
          : ['note', 'neon'];
  const alphabets = [...new Set([...byGenre, ...era])];
  const source = [genre, year == null ? '' : year + ' г.'].filter(Boolean).join(', ');
  const why: WhyLine = {
    param: 'page.lettering',
    text: `${source ? 'Песня (' + source + ') задала' : 'Для записи без жанра и года взяты'} материалы заголовка: ${alphabets.map((set) => names[set]).join(', ')}. Порядок вырезок повторяется по номеру и дате дня.`,
  };
  return { alphabets, why };
}

export function cutWords(title: string, sets: readonly CutAlphabet[], id: string) {
  const random = seeded(id);
  const palette = sets.length ? sets : ['news' as const];
  return title
    .normalize('NFC')
    .trim()
    .split(/\s+/u)
    .map((word) => {
      let previous: CutAlphabet | undefined;
      return Array.from(word, (char) => {
        const choices = palette.length > 1 ? palette.filter((set) => set !== previous) : palette;
        const alphabet = choices[Math.floor(random() * choices.length)];
        previous = alphabet;
        return {
          char,
          alphabet,
          rotation: Math.round(random() * 12 - 6),
          lift: Math.round(random() * 9 - 4),
          height: 0.88 + random() * 0.12,
          width: /[шщжюмф]/iu.test(char) ? 1.25 : /[гтз]/iu.test(char) ? 0.83 : 1,
        };
      });
    });
}

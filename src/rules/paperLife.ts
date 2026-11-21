import type { DayInput, PageElement } from '../types/dayspec';
import { seeded } from './util';

const paperName = {
  ruled: 'линейка с полем',
  grid: 'клетка',
  dots: 'точечная сетка',
  kraft: 'крафт',
  plain: 'гладкая бумага',
};
type Paper = keyof typeof paperName;
type Box = [number, number, number, number, number?];
type Scrap = (
  motif: string,
  leaf: PageElement['leaf'],
  box: Box,
  layer?: number,
  phase?: number,
) => void;

export function isPaperTrace(motif: string) {
  return /^(sheet-|reverse-ink$|bent-corner$|erased-graphite$)/.test(motif);
}

export function paperLife(
  input: DayInput,
  id: string,
  energy: number,
  has: (motif: string) => boolean,
  scrap: Scrap,
) {
  const random = seeded(id + '-paper');
  const age = (input.song?.year ?? 2100) < 2000;
  let pair: [Paper, Paper] = ['plain', 'ruled'];
  let clue = 'Для спокойного темпа и записи оставлены гладкий и линованный листы.';
  if (has('mountain')) {
    pair = ['plain', 'dots'];
    clue =
      'Горный снимок лежит на гладком листе. Точки на соседнем листе помогают помечать маршрут.';
  } else if (input.photos.length >= 3 && energy >= 0.72) {
    pair = ['grid', 'kraft'];
    clue =
      'На клетке выровнены кармашек и малые кадры. Крафт держит плотную вклейку на соседнем листе.';
  } else if (input.mood === 'restless' && energy >= 0.72) {
    pair = ['kraft', 'ruled'];
    clue = 'Крафт под плотным коллажем, линейка с полем под рублеными фразами.';
  } else if (input.mood === 'wistful') {
    pair = ['grid', 'plain'];
    clue = 'Малые кадры лежат на клетке, вокруг отдельного рассказа оставлен гладкий лист.';
  } else if (age) {
    pair = ['dots', 'grid'];
    clue = 'Для плёночных отпечатков выбраны пожелтевшие листы с точками и клеткой.';
  }
  (['left', 'right'] as const).forEach((leaf, i) => {
    scrap('sheet-' + pair[i], leaf, [0, 0, 100, 100], 0, 0);
    const shift = Math.round(random() * 13);
    scrap('reverse-ink', leaf, [12 + shift, 48 + (1 - i) * 12, 60, 23, i === 0 ? -6 : 4], 1, 0);
    if (i === 1) {
      scrap('erased-graphite', leaf, [15 + shift, age ? 51 : 55, 62, 12, random() * 6 - 3], 1, 0);
    }
    if (age || energy >= 0.72)
      scrap('bent-corner', leaf, i === 0 ? [0, 89, 13, 11] : [87, 0, 13, 11], 1, 0);
  });
  return `${paperName[pair[0]]} слева, ${paperName[pair[1]]} справа. ${clue} Остались следы оборота, нажима и стёртая карандашная пометка из записи.`;
}

import type { DayInput, PageElement, Rect } from '../types/dayspec';
import { capitalize, seeded } from './util';

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

// Лист 4:5, поэтому при повороте ширина и высота меняются в разных единицах.
function paperBounds(rect: Rect, rotation: number, scale = 1): Rect {
  const angle = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(angle));
  const cos = Math.abs(Math.cos(angle));
  const w = scale * (rect.w * cos + (rect.h * sin) / 0.8);
  const h = scale * (rect.h * cos + rect.w * sin * 0.8);
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h };
}

function clearSpace(a: Rect, b: Rect) {
  const gap = 0.02;
  return (
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

function placeGraphite(items: PageElement[], rotation: number, scrap: Scrap) {
  for (const leaf of ['right', 'left'] as const) {
    const pocket = items.some(
      (e) => e.leaf === leaf && e.kind === 'sticker' && e.motif === 'life-pocket',
    );
    const occupied = items
      .filter(
        (e) =>
          e.leaf === leaf &&
          !(e.kind === 'sticker' && (e.motif.startsWith('sheet-') || e.motif === 'reverse-ink')),
      )
      .map((e) => {
        const bounds = paperBounds(e, e.rotation, e.scale);
        // При раскрытии кармашка отпечаток поднимается над исходным местом.
        const travel = pocket && e.kind === 'photo' ? e.h * 0.36 : 0;
        return { ...bounds, y: bounds.y - travel, h: bounds.h + travel };
      });
    for (const [w, h] of [
      [0.43, 0.075],
      [0.32, 0.06],
      [0.21, 0.05],
    ]) {
      for (const row of [54, 59, 64, 69, 74, 79, 84, 89, 49, 44, 39, 34, 29, 24, 19, 14]) {
        for (let col = 10; col <= 92 - w * 100; col += 2) {
          const x = col / 100;
          const y = row / 100;
          const bounds = paperBounds({ x, y, w, h }, rotation);
          if (occupied.every((item) => clearSpace(bounds, item))) {
            scrap('erased-graphite', leaf, [100 * x, 100 * y, 100 * w, 100 * h, rotation], 1, 0);
            return true;
          }
        }
      }
    }
  }
  return false;
}

export function paperLife(
  input: DayInput,
  id: string,
  energy: number,
  has: (motif: string) => boolean,
  items: PageElement[],
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
    if (age || energy >= 0.72)
      scrap('bent-corner', leaf, i === 0 ? [0, 89, 13, 11] : [87, 0, 13, 11], 1, 0);
  });
  const graphite = placeGraphite(items, random() * 6 - 3, scrap);
  const note = graphite ? ' На свободном поле видна стёртая карандашная пометка.' : '';
  return `${capitalize(paperName[pair[0]])} слева, ${paperName[pair[1]]} справа. ${clue} Остались следы оборота и нажима.${note}`;
}

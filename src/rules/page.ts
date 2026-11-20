import type {
  DaySpec,
  DayInput,
  PageSpec,
  PageElement,
  PageContent,
  Rect,
  WhyLine,
} from '../types/dayspec';
import { objectsIn } from './objects';
import type { TextRules } from './text';
import { clamp, round } from './util';

type Leaf = PageElement['leaf'];
type Draft = Pick<DaySpec, 'id' | 'photos' | 'mode' | 'duo' | 'ink' | 'reveal'>;
const box = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

function seeded(id: string) {
  let state = 2166136261;
  for (const c of id) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Запас под поворот и белую кайму. Соотношение сторон листа 4:5. */
export function footprint(e: PageElement): Rect {
  const angle = (Math.abs(e.rotation) * Math.PI) / 180;
  const w = e.scale * (e.w * Math.cos(angle) + e.h * 1.25 * Math.sin(angle));
  const h = e.scale * (e.h * Math.cos(angle) + e.w * 0.8 * Math.sin(angle));
  return box(e.x + (e.w - w) / 2 - 0.004, e.y + (e.h - h) / 2 - 0.004, w + 0.008, h + 0.008);
}
export function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function prints(count: number, overlap: boolean, quiet: boolean): Rect[] {
  if (count === 1) return [box(0.1, 0.2, 0.8, 0.58)];
  if (count === 2) {
    if (overlap) return [box(0.09, 0.19, 0.79, 0.48), box(0.47, 0.61, 0.44, 0.29)];
    if (quiet) return [box(0.17, 0.2, 0.66, 0.37), box(0.32, 0.65, 0.41, 0.25)];
    return [box(0.11, 0.19, 0.77, 0.4), box(0.15, 0.66, 0.49, 0.27)];
  }
  const small = count === 3 ? 0.38 : 0.26;
  return [
    box(0.11, 0.17, 0.78, 0.42),
    ...Array.from({ length: count - 1 }, (_, i) =>
      count === 5
        ? box(0.12 + (i % 2) * 0.39, 0.64 + Math.floor(i / 2) * 0.16, 0.36, 0.15)
        : box(0.08 + i * (small + 0.02), 0.65 + (i % 2) * 0.045, small, 0.24),
    ),
  ];
}

export function buildPage(
  input: DayInput,
  spec: Draft,
  text: TextRules,
): { page: PageSpec; why: WhyLine[] } {
  const random = seeded(spec.id);
  const why: WhyLine[] = [];
  const reason = (param: string, line: string) => why.push({ param: 'page.' + param, text: line });
  const energy = clamp(
    Number.isFinite(input.song?.features?.energy) ? input.song!.features!.energy : 0.45,
    0,
    1,
  );
  const choppy = text.sentences.length >= 3 && text.avgWords < 5;
  const budget = clamp(Math.round(1 + 8 * energy + (choppy && energy > 0.4 ? 1 : 0)), 2, 10);
  const stock =
    spec.mode === 'film' || (input.song?.year ?? 2100) < 2000
      ? 'aged'
      : ({ quiet: 'white', warm: 'cream', duotone: 'kraft' } as const)[spec.mode];
  const marker = spec.duo[1];
  const elements: PageElement[] = [];
  const tilt = (max: number) => round((random() * 2 - 1) * max, 1);
  function item(
    content: PageContent,
    leaf: Leaf,
    rect: Rect,
    layer: number,
    rotation = 0,
    color = spec.ink,
  ): PageElement {
    return { ...content, ...rect, leaf, rotation, scale: 1, color, layer, beat: 0 };
  }
  const slots = [...spec.photos].sort(
    (a, b) => Number(b.role === 'key') - Number(a.role === 'key'),
  );
  const rects = prints(slots.length, slots[0]?.overlap ?? false, spec.mode === 'quiet');
  slots.forEach((slot, i) => {
    const r = rects[i];
    const rotation = tilt(i ? (slots.length > 3 ? 2 : 3 + energy * 6) : 2);
    const p = item(
      { kind: 'photo', photoId: slot.photoId },
      'left',
      r,
      slot.role === 'key' ? 3 : 4,
      rotation,
    );
    elements.push(p);
    const corners = i === 0 || energy > 0.65 ? [0.1, 0.82] : [0.2];
    for (const corner of corners) {
      const cx = r.x + r.w * corner,
        cy = r.y + r.h * 0.02;
      const a = (rotation * Math.PI) / 180,
        dx = cx - r.x - r.w / 2,
        dy = cy - r.y - r.h / 2;
      const x = r.x + r.w / 2 + dx * Math.cos(a) - dy * 1.25 * Math.sin(a);
      const y = r.y + r.h / 2 + dx * 0.8 * Math.sin(a) + dy * Math.cos(a);
      const width = Math.min(0.18, r.w * 0.34);
      elements.push(
        item(
          { kind: 'tape', photoId: slot.photoId },
          'left',
          box(x - width / 2, y - 0.015, width, 0.032),
          5,
          tilt(12) + (corner > 0.5 ? 13 : -13),
          marker,
        ),
      );
    }
  });
  const body = box(
    0.11,
    0.28,
    0.78,
    clamp(0.085 + text.sentences.length * 0.037 + text.words * 0.0045, 0.19, 0.43),
  );
  elements.push(item({ kind: 'text', sentences: text.sentences }, 'right', body, 4));
  if (input.mood)
    elements.push(
      item({ kind: 'mood', mood: input.mood }, 'left', box(0.09, 0.036, 0.25, 0.1), 4, -3),
    );
  if (input.weather)
    elements.push(
      item(
        { kind: 'weather', weather: input.weather },
        'right',
        box(0.46, 0.04, 0.45, 0.115),
        4,
        2,
      ),
    );
  if (input.song)
    elements.push(item({ kind: 'ticket' }, 'right', box(0.1, 0.8, 0.78, 0.133), 4, tilt(2)));
  elements.push(item({ kind: 'date' }, 'right', box(0.57, 0.94, 0.34, 0.04), 3));
  reason(
    'prints',
    slots.length === 1
      ? 'Единственный отпечаток занимает середину листа.'
      : slots[0]?.overlap
        ? 'Слова о близости сближают отпечатки, их края заходят друг на друга.'
        : `Кадров ${slots.length}. Главный отпечатан крупнее, остальные собраны рядом с ним.`,
  );
  reason(
    'stock',
    `Для режима ${{ quiet: 'тихого света', film: 'плёнки', duotone: 'двух красок', warm: 'тёплого света' }[spec.mode]} выбрана ${{ aged: 'состаренная', white: 'белая', cream: 'кремовая', kraft: 'крафтовая' }[stock]} бумага${input.song?.year ? ' · песня ' + input.song.year + ' года' : ''}.`,
  );
  reason('marker', 'Светлая краска со снимков тонирует маркер и ленты на уголках.');
  reason('text', 'В правом поле сохранён порядок фраз автора, главная подчёркнута.');
  if (input.mood) reason('mood', 'Настроение выбрал автор и подписал им верхний угол.');
  if (input.weather)
    reason(
      'weather',
      `Погода сохранена для места «${input.weather.place}», на ${input.weather.hour} ч.`,
    );
  if (input.song) reason('ticket', 'Название песни и её пульс собраны в памятный билет.');
  reason('date', 'Дата записи служит номером листа.');
  const hits = objectsIn(text.sentences).sort(
    (a, b) => Number(b.sentence === text.key.sentence) - Number(a.sentence === text.key.sentence),
  );
  const motifs = hits.map((hit) => hit.motif);
  const related = [
    ...(motifs.some((motif) => ['train', 'ticket', 'case', 'clock'].includes(motif))
      ? ['rail-label', 'ticket']
      : []),
    ...(motifs.includes('cup') ? ['tea-label'] : []),
    ...(motifs.includes('mountain') ? ['ridge-label', 'leaf'] : []),
    'postmark',
    'arrow',
    'spark',
    'star',
  ].filter((motif) => !motifs.includes(motif));
  const anchors = [0.7, 0.12, 0.9, 0.59, 0.18, 0.75, 0.09];
  const grid: { leaf: Leaf; x: number; y: number }[] = [];
  for (const leaf of ['right', 'left'] as const) {
    for (let row = 0; row < 22; row++)
      for (let col = 0; col < 21; col++) {
        grid.push({
          leaf,
          x: 0.035 + col * 0.044 + random() * 0.01,
          y: 0.029 + row * 0.043 + random() * 0.01,
        });
      }
  }
  function place(
    content: PageContent,
    width: number,
    height: number,
    rotation: number,
    color: string,
    scores: (e: PageElement) => number,
    sizes: number[],
  ) {
    const obstacles = elements.map((element) => ({ leaf: element.leaf, rect: footprint(element) }));
    for (const size of sizes) {
      let best: PageElement | undefined;
      let score = Infinity;
      for (const { leaf, x, y } of grid) {
        const e = item(content, leaf, box(x, y, width * size, height * size), 6, rotation, color);
        const area = footprint(e);
        if (area.x < 0.028 || area.y < 0.021 || area.x + area.w > 0.974 || area.y + area.h > 0.975)
          continue;
        if (obstacles.some((other) => other.leaf === leaf && intersects(area, other.rect)))
          continue;
        const distance = scores(e);
        if (distance < score) {
          score = distance;
          best = e;
        }
      }
      if (best) {
        elements.push(best);
        return true;
      }
    }
    return false;
  }

  let placed = 0;
  for (const [i, motif] of [...motifs, ...related].slice(0, budget).entries()) {
    const hit = hits[i];
    const rotation = tilt(4 + energy * 10);
    const wide = ['rail-label', 'tea-label', 'ridge-label', 'ticket', 'arrow', 'postmark'].includes(
      motif,
    );
    const tiny = motif === 'spark' || motif === 'star';
    const width = hit
      ? i === 0
        ? 0.255 + energy * 0.07
        : 0.162 + random() * 0.06
      : wide
        ? 0.17 + random() * 0.08
        : tiny
          ? 0.072 + random() * 0.025
          : 0.15;
    const freeWeatherCorner = motif === 'postmark' && !input.weather;
    const preferredY = freeWeatherCorner
      ? 0.13
      : hit
        ? body.y + (body.h * (hit.sentence + 0.5)) / Math.max(1, text.sentences.length)
        : anchors[(i - hits.length) % anchors.length];
    const content: PageContent = { kind: 'sticker', motif, sentence: hit?.sentence };
    const added = place(
      content,
      width,
      width * (wide ? 0.445 : 0.8),
      rotation,
      motif === 'postmark' ? '#8c4934' : spec.ink,
      (e) =>
        Math.abs(e.y + e.h / 2 - preferredY) +
        (hit && e.leaf === 'left' ? 0.09 : 0) +
        (freeWeatherCorner ? (e.leaf === 'left' ? 1 : Math.abs(e.x + e.w / 2 - 0.72)) : 0) +
        random() * 0.1,
      [1, 0.83, 0.66, 0.49],
    );
    if (!added) continue;
    placed++;
    if (hit) reason('sticker', `Слово «${hit.word}» оставило рисунок возле записи.`);
  }
  reason(
    'density',
    `На полях ${placed} рисунков. Энергия песни ${Math.round(energy * 100)}%, ${choppy ? 'короткие отрывистые фразы уплотняют страницу' : 'между фразами оставлено место'}.`,
  );
  // Бумажные детали занимают только те карманы, которые остались после отпечатков и рисунков.
  function detail(motif: string, leaf: Leaf, target: Rect, rotation: number) {
    return place(
      { kind: 'sticker', motif },
      target.w,
      target.h,
      rotation,
      spec.ink,
      (e) =>
        Math.abs(e.y + e.h / 2 - target.y) +
        0.7 * Math.abs(e.x + e.w / 2 - target.x) +
        (e.leaf === leaf ? 0 : 0.55) +
        random() * 0.034,
      [1, 0.83, 0.68],
    );
  }

  if (slots.length > 0) {
    const swatchY = slots.length === 1 ? 0.875 : 0.105;
    if (detail('paper-swatches', 'left', box(0.33, swatchY, 0.345, 0.095), tilt(7))) {
      reason(
        'swatches',
        'Под отпечатком или на свободном поле осталась выкраска из его тёмных и светлых тонов.',
      );
    }
    const motif = stock === 'kraft' ? 'paper-graph' : 'paper-tracing';
    if (
      detail(
        motif,
        'right',
        box(0.46, Math.min(0.75, body.y + body.h + 0.12), 0.445, 0.132),
        tilt(6),
      )
    ) {
      reason(
        'scrap',
        'На свободном поле возле текста осталась карандашная схема кадрирования главного фото.',
      );
    }
    if (
      (stock === 'aged' || slots.length === 1) &&
      detail('paper-film', 'left', box(0.73, 0.115, 0.245, 0.052), tilt(10))
    ) {
      reason('filmOffcut', 'В свободном углу приклеен обрезок перфорированной плёнки.');
    }
  }
  const total = Math.max(0, spec.reveal.beats.length - 1);
  elements.forEach((e, i) => {
    e.beat = Math.round((i * total) / Math.max(1, elements.length - 1));
  });
  reason('rhythm', 'Элементы распределены по долям песни, главный кадр отложен до её пика.');
  return { page: { stock, marker, elements }, why };
}

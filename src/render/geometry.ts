import type { DaySpec, Layout, Rect } from '../types/dayspec';

/**
 * Геометрия книжки. Все длины — в долях высоты листа H, пока не сказано «px».
 * Здесь только чистые функции: их проверяет Vitest, а Book.tsx только рисует.
 */

export const COVER_W = 0.8;
/** Ширина одной половины разворота. */
export const HALF_W = 0.64;
export const SPREAD_W = HALF_W * 2;
/** Наклон половин разворота: корешок чуть уходит вглубь. */
export const SPREAD_TILT = 5;
/** Складки не бывают тоньше этого: иначе от кадра остаётся одна линия. */
export const MIN_STRIP = 0.1;

export type PanelKind = 'cover' | 'fold' | 'half';

export interface PanelPlan {
  kind: PanelKind;
  /** Ширина полосы. */
  w: number;
  /** Абсолютный угол в раскрытой книжке, градусы. */
  openA: number;
  /** Абсолютный угол в сложенной: 0 или 180, всё ложится стопкой за обложку. */
  closedA: number;
  /** Номер группы: полосы одного эпизода рисуют одну картинку, разрезанную сгибами. */
  group: number;
  /** Сдвиг полосы внутри группы. */
  offset: number;
  /** Полная ширина группы. */
  groupW: number;
  /** Номер эпизода среди складок, от 0. */
  episode: number;
  side?: 'L' | 'R';
  text?: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function openAngle(density: number): number {
  return 46 + 28 * clamp(density, 0, 1);
}

export function planBook(spec: DaySpec): PanelPlan[] {
  const theta = openAngle(spec.rhythm.density);
  const strips = spec.rhythm.beatsPerFold === 4 ? 2 : 1;
  const panels: PanelPlan[] = [];
  let group = 0;
  let episode = 0;
  let i = 0;
  const closed = () => (i % 2 === 0 ? 0 : 180);

  panels.push({
    kind: 'cover',
    w: COVER_W,
    openA: theta,
    closedA: 0,
    group: group++,
    offset: 0,
    groupW: COVER_W,
    episode: -1,
  });
  i++;

  // Зигзаг: углы чередуются, поэтому знак считаем по номеру полосы в своём участке.
  const addFold = (text: string, width: number, firstSign: number) => {
    const stripW = clamp((width * SPREAD_W) / strips, MIN_STRIP, 0.6);
    const g = group++;
    for (let k = 0; k < strips; k++) {
      panels.push({
        kind: 'fold',
        w: stripW,
        openA: theta * firstSign * (k % 2 === 0 ? 1 : -1),
        closedA: closed(),
        group: g,
        offset: k * stripW,
        groupW: stripW * strips,
        episode,
        text: k === 0 ? text : undefined,
      });
      i++;
    }
    episode++;
  };

  // Знак первой полосы эпизода: продолжаем чередование с предыдущей полосой.
  const nextSign = () => {
    const last = panels[panels.length - 1];
    return last.kind === 'half' ? 1 : last.openA > 0 ? -1 : 1;
  };

  for (const f of spec.folds.filter((x) => x.side === 'before'))
    addFold(f.text, f.width, nextSign());

  const g = group++;
  for (const side of ['L', 'R'] as const) {
    panels.push({
      kind: 'half',
      w: HALF_W,
      openA: side === 'L' ? SPREAD_TILT : -SPREAD_TILT,
      closedA: closed(),
      group: g,
      offset: side === 'L' ? 0 : HALF_W,
      groupW: SPREAD_W,
      episode: -1,
      side,
    });
    i++;
  }

  for (const f of spec.folds.filter((x) => x.side === 'after'))
    addFold(f.text, f.width, nextSign());
  return panels;
}

/** Углы, при которых полоса на самом деле стоит в раскрытой и сложенной книжке. */
export const openAngles = (plan: PanelPlan[]) => plan.map((q) => q.openA);
export const closedAngles = (plan: PanelPlan[]) => plan.map((q) => q.closedA);

/** Раскрытие идёт каскадом: каждая следующая полоса стартует чуть позже. */
const STAGGER = 0.55;

export function panelT(i: number, n: number, p: number): number {
  const delay = n > 1 ? (STAGGER * i) / (n - 1) : 0;
  const t = clamp((p - delay) / (1 - STAGGER), 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function anglesAt(plan: PanelPlan[], p: number): number[] {
  return plan.map((q, i) => lerp(q.closedA, q.openA, panelT(i, plan.length, p)));
}

const rad = (d: number) => (d * Math.PI) / 180;

export interface Extent {
  /** Где заканчивается каждая полоса по горизонтали, считая от начала цепочки. */
  ends: number[];
  min: number;
  max: number;
}

/** Проекция цепочки на экран: нужна, чтобы центрировать книжку и подобрать высоту. */
export function chainExtent(plan: PanelPlan[], angles: number[]): Extent {
  let x = 0;
  let min = 0;
  let max = 0;
  const ends: number[] = [];
  plan.forEach((q, i) => {
    x += q.w * Math.cos(rad(angles[i]));
    ends.push(x);
    min = Math.min(min, x);
    max = Math.max(max, x);
  });
  return { ends, min, max };
}

// ---------- Кадры на развороте ----------

export interface Frame {
  /** Индекс в spec.photos. */
  slot: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Поворот в градусах: так лежат кадры внахлёст. */
  rot: number;
  /** Белая кромка, как у отпечатка. */
  bordered: boolean;
}

export interface SpreadLayout {
  frames: Frame[];
  textTop: number;
  textH: number;
}

export interface SpreadInput {
  layout: Layout;
  overlap: boolean;
  /** Сколько всего фото. */
  count: number;
  /** Индекс главного кадра. */
  keySlot: number;
}

/** Раскладка кадров и места под главную фразу, px. H — высота листа, S — ширина разворота, m — поле. */
export function layoutSpread(input: SpreadInput, H: number, S: number, m: number): SpreadLayout {
  const top = Math.round(H * 0.06);
  const ph = Math.round(H * 0.6);
  const cw = S - 2 * m;
  const textTop = top + ph + Math.round(H * 0.04);
  const textH = Math.round(H * 0.97) - textTop - Math.round(H * 0.05);
  const result = (frames: Frame[]): SpreadLayout => ({ frames, textTop, textH });
  const { keySlot, count } = input;
  if (count <= 0) return result([]);

  const others = Array.from({ length: count }, (_, i) => i).filter((i) => i !== keySlot);
  const layout = count === 1 ? 'window' : input.layout;

  if (layout === 'window') {
    return result([{ slot: keySlot, x: m, y: top, w: cw, h: ph, rot: 0, bordered: false }]);
  }

  if (layout === 'diptych') {
    const support = others[0] ?? keySlot;
    if (input.overlap) {
      const w = Math.round(cw * 0.56);
      return result([
        {
          slot: support,
          x: m,
          y: top + Math.round(ph * 0.06),
          w,
          h: Math.round(ph * 0.86),
          rot: -1.4,
          bordered: true,
        },
        {
          slot: keySlot,
          x: S - m - w,
          y: top,
          w,
          h: Math.round(ph * 0.92),
          rot: 1.1,
          bordered: true,
        },
      ]);
    }
    const gap = Math.round(H * 0.05);
    const w = Math.round((cw - gap) / 2);
    return result([
      { slot: support, x: m, y: top, w, h: ph, rot: 0, bordered: false },
      { slot: keySlot, x: S - m - w, y: top, w, h: ph, rot: 0, bordered: false },
    ]);
  }

  // Контактный лист: главный кадр сверху, остальные рядом ниже.
  const keyH = Math.round(ph * 0.66);
  const rowTop = top + keyH + Math.round(H * 0.03);
  const rowH = top + ph - rowTop;
  const n = Math.min(others.length, 4);
  const frames: Frame[] = [
    { slot: keySlot, x: m, y: top, w: cw, h: keyH, rot: 0, bordered: false },
  ];
  if (n > 0) {
    if (input.overlap) {
      const w = Math.round(cw / (n * 0.82 + 0.18));
      const step = Math.round(w * 0.82);
      const used = step * (n - 1) + w;
      const x0 = Math.round((S - used) / 2);
      for (let k = 0; k < n; k++) {
        frames.push({
          slot: others[k],
          x: x0 + k * step,
          y: rowTop + (k % 2 === 0 ? 0 : Math.round(rowH * 0.06)),
          w,
          h: Math.round(rowH * 0.94),
          rot: k % 2 === 0 ? -1.6 : 1.3,
          bordered: true,
        });
      }
    } else {
      const gap = Math.round(H * 0.04);
      const w = Math.round((cw - gap * (n - 1)) / n);
      for (let k = 0; k < n; k++) {
        frames.push({
          slot: others[k],
          x: m + k * (w + gap),
          y: rowTop,
          w,
          h: rowH,
          rot: 0,
          bordered: false,
        });
      }
    }
  }
  return result(frames);
}

// ---------- Картинка в окне ----------

/**
 * Где положить картинку, чтобы фрагмент region (доли 0..1) закрыл окно cw×ch.
 * Результат — доли окна: left, top, width, height. Размеры окна нужны только как отношение.
 */
export function fitRegion(
  iw: number,
  ih: number,
  cw: number,
  ch: number,
  region: Rect,
): { left: number; top: number; width: number; height: number } {
  const rw = Math.max(1e-3, region.w) * iw;
  const rh = Math.max(1e-3, region.h) * ih;
  const s = Math.max(cw / rw, ch / rh);
  const dw = iw * s;
  const dh = ih * s;
  const left = clamp(cw / 2 - (region.x + region.w / 2) * dw, cw - dw, 0);
  const top = clamp(ch / 2 - (region.y + region.h / 2) * dh, ch - dh, 0);
  return { left: left / cw, top: top / ch, width: dw / cw, height: dh / ch };
}

/** Окно на всю картинку с центром в точке (fx, fy). */
export function focusRegion(fx: number, fy: number): Rect {
  return { x: fx - 0.5, y: fy - 0.5, w: 1, h: 1 };
}

export function regionCenter(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

// ---------- Текст ----------

/** Кегль, при котором фраза уместится в коробку. Оценка по средней ширине знака Literata. */
export function fitFont(
  text: string,
  boxW: number,
  boxH: number,
  maxPx: number,
  minPx: number,
  lineHeight = 1.28,
): number {
  const chars = Math.max(1, text.length);
  for (let fs = maxPx; fs >= minPx; fs -= 0.5) {
    const perLine = Math.max(1, Math.floor(boxW / (fs * 0.5)));
    const lines = Math.ceil(chars / perLine) + (chars > perLine ? 0.4 : 0);
    if (lines * fs * lineHeight <= boxH) return fs;
  }
  return minPx;
}

// ---------- Время раскрытия ----------

export interface BeatStep {
  /** Через сколько мс от старта шагнуть. */
  at: number;
  /** Прогресс раскрытия после шага, 0..1. */
  to: number;
}

/** Раскрытие без звука шагами по сильным долям, растянутыми на durationMs. */
export function beatSchedule(beats: number[], durationMs: number): BeatStep[] {
  const b = [...beats].sort((x, y) => x - y);
  if (b.length < 2) return [];
  const span = b[b.length - 1] - b[0] || 1;
  // Не больше 12 шагов: гармошка раскрывается рывками, но не дробится в пыль.
  const stride = Math.max(1, Math.ceil(b.length / 12));
  const picked = b.filter((_, i) => i % stride === 0 || i === b.length - 1);
  return picked.map((t, i) => ({
    at: ((t - picked[0]) / span) * durationMs,
    to: (i + 1) / picked.length,
  }));
}

/**
 * Прогресс раскрытия по времени звука. Разворот раскрыт полностью ровно на peakSec,
 * а раскрытие длится windowSec до пика.
 */
export function audioProgress(currentSec: number, peakSec: number, windowSec: number): number {
  if (windowSec <= 0) return currentSec >= peakSec ? 1 : 0;
  return clamp(1 - (peakSec - currentSec) / windowSec, 0, 1);
}

const STEP_MS = 300;

/** Сколько длится раскрытие по шагам: до последнего шага плюс его собственный ход. */
export function stepsDuration(steps: BeatStep[]): number {
  return steps.length ? steps[steps.length - 1].at + STEP_MS : 0;
}

/** Прогресс раскрытия в момент tMs: каждый шаг плавно подтягивает его к своей цели. */
export function steppedProgress(steps: BeatStep[], tMs: number): number {
  let p = 0;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (tMs < s.at) break;
    const k = clamp((tMs - s.at) / STEP_MS, 0, 1);
    const ease = 1 - Math.pow(1 - k, 3);
    p = lerp(p, s.to, ease);
    if (k < 1) break;
  }
  return p;
}

/** Окно раскрытия в секундах: не длиннее, чем разбег до пика. */
export function revealWindow(durationMs: number, peakSec: number, prerollSec: number): number {
  const run = Math.min(prerollSec, peakSec);
  return Math.max(0.2, Math.min(durationMs / 1000, run));
}

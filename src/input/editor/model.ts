/**
 * Геометрия редактора. Единица — ширина одного листа: разворот занимает 2 × 1,25,
 * поэтому повороты и щипок считаются без искажений.
 */
import type { Point } from '../../types/dayspec';
import type { PieceLook, SheetItem, SheetLeaf } from '../../types/sheet';
import type { Cutout } from './catalog';

export const LEAF_H = 1.25;

export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
  turn: number;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number) => Math.round(v * 10000) / 10000;

export function boxOf(item: SheetItem): Box {
  return {
    cx: (item.leaf === 'right' ? 1 : 0) + item.x + item.w / 2,
    cy: (item.y + item.h / 2) * LEAF_H,
    w: item.w * item.scale,
    h: item.h * item.scale * LEAF_H,
    turn: (item.rotation * Math.PI) / 180,
  };
}

export function withLook(item: SheetItem, patch: Partial<PieceLook>): SheetItem {
  const look = Object.fromEntries(
    Object.entries({ ...item.look, ...patch }).filter(([, v]) => v !== undefined),
  ) as PieceLook;
  if (Object.keys(look).length) return { ...item, look };
  const { look: _, ...plain } = item;
  return plain as SheetItem;
}

/** Центр в новую точку. Страницу задаёт центр, потерять вклейку за краем нельзя. */
export function moveTo(item: SheetItem, at: Point): SheetItem {
  const cx = clamp(at.x, 0, 2);
  const cy = clamp(at.y, 0, LEAF_H);
  const leaf: SheetLeaf = cx < 1 ? 'left' : 'right';
  const moved = {
    ...item,
    leaf,
    x: round(cx - (leaf === 'right' ? 1 : 0) - item.w / 2),
    y: round(cy / LEAF_H - item.h / 2),
  };
  return item.look?.clip ? withLook(moved, { clip: undefined }) : moved;
}

export function inside(box: Box, p: Point, pad = 0): boolean {
  const dx = p.x - box.cx;
  const dy = p.y - box.cy;
  const cos = Math.cos(box.turn);
  const sin = Math.sin(box.turn);
  return (
    Math.abs(dx * cos + dy * sin) <= box.w / 2 + pad &&
    Math.abs(-dx * sin + dy * cos) <= box.h / 2 + pad
  );
}

/** Вклейки под точкой, верхние первыми. */
export function stackAt(items: SheetItem[], p: Point, pad: number): SheetItem[] {
  return items.filter((item) => inside(boxOf(item), p, pad)).reverse();
}

export function newId(): string {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function createItem(cut: Cutout, at: Point): SheetItem {
  const item: SheetItem = {
    ...cut.content,
    id: newId(),
    leaf: 'left',
    x: 0,
    y: 0,
    w: cut.w,
    h: round(cut.w / cut.ratio / LEAF_H),
    rotation: cut.rotation ?? 0,
    scale: 1,
    color: cut.color ?? '#263653',
    layer: cut.layer,
    at: 1,
  };
  if (cut.look) item.look = { ...cut.look };
  return moveTo(item, at);
}

/** Скотч, который держит этот отпечаток: едет и удаляется вместе с ним. */
export function attached(items: SheetItem[], picked: SheetItem[]): SheetItem[] {
  const prints = picked.filter((item) => item.kind === 'photo');
  if (!prints.length) return picked;
  const tapes = items.filter(
    (item) =>
      item.kind === 'tape' &&
      !picked.includes(item) &&
      prints.some((print) => {
        const box = boxOf(item);
        return (
          print.photoId === item.photoId &&
          inside(boxOf(print), { x: box.cx, y: box.cy }, Math.max(box.w, box.h) / 2)
        );
      }),
  );
  return [...picked, ...tapes];
}

export type Restack = 'top' | 'up' | 'down' | 'bottom';

export function restack(items: SheetItem[], ids: string[], to: Restack): SheetItem[] {
  const picked = items.filter((item) => ids.includes(item.id));
  if (!picked.length) return items;
  const rest = items.filter((item) => !ids.includes(item.id));
  if (to === 'top') return [...rest, ...picked];
  if (to === 'bottom') return [...picked, ...rest];
  // Шаг — через ближайшую вклейку, которая перекрывается: иначе нажатие ничего не меняет на глаз.
  const radius = (box: Box) => Math.hypot(box.w, box.h) / 2;
  const touches = (other: SheetItem) =>
    picked.some((item) => {
      const a = boxOf(item);
      const b = boxOf(other);
      return Math.hypot(a.cx - b.cx, a.cy - b.cy) < radius(a) + radius(b);
    });
  const up = to === 'up';
  const edge = items.indexOf(up ? picked[picked.length - 1] : picked[0]);
  const ahead = rest.filter((item) =>
    up ? items.indexOf(item) > edge : items.indexOf(item) < edge,
  );
  if (!up) ahead.reverse();
  const next = ahead.find(touches) ?? ahead[0];
  if (!next) return items;
  const at = rest.indexOf(next) + (up ? 1 : 0);
  return [...rest.slice(0, at), ...picked, ...rest.slice(at)];
}

export function snap(value: number, targets: number[], reach: number): number | null {
  let best: number | null = null;
  for (const target of targets) {
    const distance = Math.abs(target - value);
    if (distance <= reach && (best === null || distance < Math.abs(best - value))) best = target;
  }
  return best;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent,
} from 'react';
import type { Point } from '../../types/dayspec';
import type { SheetItem } from '../../types/sheet';
import { cutoutByKey } from './catalog';
import type { Editor } from './context';
import { FlatSpread } from './FlatSpread';
import { Surroundings } from './Surroundings';
import { photoCutout } from './names';
import { attached, boxOf, clamp, inside, LEAF_H, moveTo, snap, stackAt, type Box } from './model';

type Gesture =
  | { mode: 'pan'; x: number; y: number; left: number; top: number }
  | {
      mode: 'move';
      from: Point;
      starts: SheetItem[];
      lead: SheetItem;
      /** Нажатие без протяжки выбирает это. */
      tap: string | null;
    }
  | { mode: 'scale' | 'rotate' | 'n' | 'e' | 's' | 'w'; from: Point; start: SheetItem; box: Box }
  | { mode: 'pinch'; start: SheetItem; box: Box; gap: number; turn: number; mid: Point };

const CORNERS = ['nw', 'ne', 'se', 'sw'] as const;
const SIDES = ['n', 'e', 's', 'w'] as const;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const normal = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;

/** Холст: разворот рисует тот же DaySpread, жесты живут прозрачным слоем поверх него. */
export function SheetCanvas({
  editor,
  zoom,
  magnet,
}: {
  editor: Editor;
  zoom: number;
  magnet: boolean;
}) {
  const { spec, items, selected, view } = editor;
  const canvas = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  const gesture = useRef<{ data: Gesture; tag: string; moved: boolean; at: Point } | null>(null);
  const pointers = useRef(new Map<number, Point>());

  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const measure = () => {
      // Размер рамки, а не содержимого: при увеличении полосы прокрутки его меняют.
      setRoom({ w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const leaves = view === 'both' ? 2 : 1;
  const pad = room.w < 600 ? 14 : 40;
  const unit = Math.max(
    60,
    Math.min((room.w - pad * 2) / leaves, (room.h - pad * 2) / LEAF_H) * zoom,
  );
  const offset = view === 'right' ? unit : 0;
  const reach = 7 / unit;
  const inView = useMemo(
    () =>
      view === 'both'
        ? items
        : items.filter((item) => {
            const box = boxOf(item);
            const half = Math.max(box.w, box.h) / 2;
            return view === 'left' ? box.cx - half < 1 : box.cx + half > 1;
          }),
    [items, view],
  );

  const point = (at: { clientX: number; clientY: number }): Point => {
    const r = sheet.current!.getBoundingClientRect();
    return { x: (at.clientX - r.left) / unit, y: (at.clientY - r.top) / unit };
  };

  function begin(data: Gesture, e: PointerEvent) {
    gesture.current = {
      data,
      tag: `gesture-${e.timeStamp}-${e.pointerId}`,
      moved: false,
      at: { x: e.clientX, y: e.clientY },
    };
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !sheet.current) return;
    if ((e.target as Element).closest('.ed-empty')) return;
    const el = e.currentTarget;
    // Набор в поле заканчивается, как только взялись за лист.
    el.focus({ preventScroll: true });
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Указатель уже отпущен.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = point(e);

    if (pointers.current.size === 2) {
      if (selected.length !== 1) {
        gesture.current = null;
        return;
      }
      const [a, b] = [...pointers.current.values()];
      const mid = { x: (a.x + b.x) / 2 / unit, y: (a.y + b.y) / 2 / unit };
      begin(
        {
          mode: 'pinch',
          start: selected[0],
          box: boxOf(selected[0]),
          gap: Math.max(1, distance(a, b)),
          turn: angle(a, b),
          mid,
        },
        e,
      );
      return;
    }
    if (pointers.current.size > 2) return;

    const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-handle]')?.dataset.handle;
    if (handle && selected.length === 1) {
      const mode = handle as 'scale' | 'rotate' | 'n' | 'e' | 's' | 'w';
      begin({ mode, from: p, start: selected[0], box: boxOf(selected[0]) }, e);
      return;
    }

    const stack = stackAt(inView, p, 5 / unit);
    let top: SheetItem | undefined = stack[0];
    if (e.altKey && stack.length) {
      // Alt + нажатие — следующая вклейка под этой.
      top = stack[(stack.findIndex((item) => selected.includes(item)) + 1) % stack.length];
      editor.select([top.id]);
      begin({ mode: 'move', from: p, starts: [top], lead: top, tap: top.id }, e);
      return;
    }
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      if (!top) return;
      const ids = selected.map((item) => item.id);
      const id = top.id;
      editor.select(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
      return;
    }
    // Выбранное можно тащить, даже если сверху лежит другое.
    const held = selected.find((item) => inside(boxOf(item), p, 8 / unit));
    if (!held && !top) {
      editor.select([]);
      begin({ mode: 'pan', x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }, e);
      return;
    }
    const lead = held ?? top!;
    const group = held ? selected : [lead];
    if (!held) editor.select([lead.id]);
    begin(
      {
        mode: 'move',
        from: p,
        starts: attached(items, group),
        lead,
        tap: (top ?? lead).id,
      },
      e,
    );
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const held = pointers.current.get(e.pointerId);
    const active = gesture.current;
    if (!held) {
      if (e.pointerType === 'mouse' && sheet.current) {
        const id = stackAt(inView, point(e), 2 / unit)[0]?.id ?? null;
        if (id !== hover) setHover(id);
      }
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!active) return;
    const { data, tag } = active;
    if (!active.moved) {
      const threshold = e.pointerType === 'mouse' ? 3 : 7;
      if (data.mode !== 'pinch' && distance(active.at, { x: e.clientX, y: e.clientY }) < threshold)
        return;
      active.moved = true;
      setHover(null);
    }

    if (data.mode === 'pan') {
      e.currentTarget.scrollLeft = data.left - (e.clientX - data.x);
      e.currentTarget.scrollTop = data.top - (e.clientY - data.y);
      return;
    }
    if (data.mode === 'pinch') {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const { start, box, gap, turn, mid } = data;
      const scale = clamp(
        start.scale * (distance(a, b) / gap),
        Math.min(start.scale, 0.02 / Math.max(start.w, start.h)),
        4 / Math.max(0.01, start.w),
      );
      const next = {
        ...start,
        scale: clamp(scale, 0.05, 25),
        rotation: Math.round(normal(start.rotation + angle(a, b) - turn)),
      };
      const to = {
        x: box.cx + (a.x + b.x) / 2 / unit - mid.x,
        y: box.cy + (a.y + b.y) / 2 / unit - mid.y,
      };
      editor.update([start.id], () => moveTo(next, to), tag);
      return;
    }

    const p = point(e);
    if (data.mode === 'move') {
      const { from, starts, lead } = data;
      const box = boxOf(lead);
      let dx = p.x - from.x;
      let dy = p.y - from.y;
      let gx: number | null = null;
      let gy: number | null = null;
      if (magnet && !e.shiftKey) {
        const moving = new Set(starts.map((item) => item.id));
        const others = inView.filter((item) => !moving.has(item.id)).map(boxOf);
        // Середины страниц и сгиб сильнее соседних вклеек.
        gx =
          snap(box.cx + dx, [0.5, 1, 1.5], reach) ??
          snap(
            box.cx + dx,
            others.map((other) => other.cx),
            reach / 2,
          );
        gy =
          snap(box.cy + dy, [LEAF_H / 2], reach) ??
          snap(
            box.cy + dy,
            others.map((other) => other.cy),
            reach / 2,
          );
        if (gx !== null) dx = gx - box.cx;
        if (gy !== null) dy = gy - box.cy;
      }
      setGuides((g) => (g.x === gx && g.y === gy ? g : { x: gx, y: gy }));
      const next = new Map(
        starts.map((item) => {
          const b = boxOf(item);
          return [item.id, moveTo(item, { x: b.cx + dx, y: b.cy + dy })] as const;
        }),
      );
      editor.update([...next.keys()], (item) => next.get(item.id)!, tag);
      return;
    }

    const { from, start, box } = data;
    const center = { x: box.cx, y: box.cy };
    let next: SheetItem;
    if (data.mode === 'scale') {
      const k = distance(p, center) / Math.max(0.005, distance(from, center));
      const size = Math.max(start.w, start.h * LEAF_H);
      next = { ...start, scale: clamp(start.scale * k, 0.02 / size, Math.min(25, 4 / size)) };
    } else if (data.mode === 'rotate') {
      let degrees = start.rotation + angle(center, p) - angle(center, from);
      const right = Math.round(degrees / 90) * 90;
      if (e.shiftKey) degrees = Math.round(degrees / 15) * 15;
      else if (magnet && Math.abs(degrees - right) < 3) degrees = right;
      next = { ...start, rotation: Math.round(normal(degrees) * 10) / 10 };
    } else {
      // Боковая ручка тянет свою сторону, противоположная стоит на месте.
      const cos = Math.cos(box.turn);
      const sin = Math.sin(box.turn);
      const axis = {
        e: { x: cos, y: sin },
        w: { x: -cos, y: -sin },
        s: { x: -sin, y: cos },
        n: { x: sin, y: -cos },
      }[data.mode];
      const wide = data.mode === 'e' || data.mode === 'w';
      const was = wide ? box.w : box.h;
      const size = clamp(was + (p.x - from.x) * axis.x + (p.y - from.y) * axis.y, 0.02, 3.5);
      const shift = (size - was) / 2;
      next = moveTo(
        wide ? { ...start, w: size / start.scale } : { ...start, h: size / (start.scale * LEAF_H) },
        { x: box.cx + axis.x * shift, y: box.cy + axis.y * shift },
      );
    }
    editor.update([start.id], () => next, tag);
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    const active = gesture.current;
    if (!active) return;
    // После щипка оставшийся палец ничего не тащит.
    gesture.current = null;
    setGuides((g) => (g.x === null && g.y === null ? g : { x: null, y: null }));
    if (e.type === 'pointercancel' || active.data.mode !== 'move') return;
    const { lead, tap } = active.data;
    if (!active.moved) {
      if (tap) editor.select([tap]);
      return;
    }
    const now = items.find((item) => item.id === lead.id);
    if (now && view !== 'both') editor.reveal(now.leaf);
  }

  function edit() {
    const item = selected[0];
    if (!item) return;
    if (item.kind === 'text') {
      editor.focusField('text');
    } else if (item.kind === 'label') {
      const field = document.querySelector<HTMLTextAreaElement>('.ed-label-text');
      field?.focus();
      field?.select();
    }
  }

  function drop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      const pictures = [...e.dataTransfer.files].filter((file) => file.type.startsWith('image/'));
      if (pictures.length) editor.photos.add(pictures);
      return;
    }
    const key = e.dataTransfer.getData('text/plain');
    const cut = key.startsWith('photo:')
      ? photoCutout(editor, key.slice(6))
      : key
        ? cutoutByKey(key)
        : undefined;
    if (cut) editor.add(cut, point(e));
  }

  const outline = (item: SheetItem, state: 'hover' | 'selected') => {
    const box = boxOf(item);
    const min = state === 'selected' ? 30 : 8;
    const w = Math.max(min, box.w * unit);
    const h = Math.max(min, box.h * unit);
    const handles = state === 'selected' && selected.length === 1;
    const style = {
      left: box.cx * unit,
      top: box.cy * unit,
      width: w,
      height: h,
      transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
    } satisfies CSSProperties;
    return (
      <div key={state + item.id} className="ed-outline" data-state={state} style={style}>
        {handles && (
          <>
            {CORNERS.map((corner) => (
              <i key={corner} className="ed-handle" data-handle="scale" data-corner={corner} />
            ))}
            {SIDES.map(
              (side) =>
                (side === 'n' || side === 's' ? w : h) >= 92 && (
                  <i key={side} className="ed-handle" data-handle={side} data-side={side} />
                ),
            )}
            <i
              className="ed-handle ed-turn"
              data-handle="rotate"
              // У верхнего края ручка поворота уходит вниз, иначе её не достать.
              data-below={box.cy * unit - h / 2 < 34 || undefined}
            />
          </>
        )}
      </div>
    );
  };

  const hovered = inView.find((item) => item.id === hover && !selected.includes(item));
  // Чистый лист сам говорит, с чего начать.
  const blank = !editor.design.items.length && !editor.design.frozen;
  const askPhoto = blank && !editor.photos.items.length && view !== 'right';
  const askText = blank && !editor.text.trim() && view !== 'left';
  const weatherSlot =
    editor.weather?.on &&
    !editor.design.frozen?.seen.includes('weather') &&
    !items.some((item) => item.kind === 'weather') &&
    view !== 'left';

  return (
    <div className="ed-stage" data-light={spec.page.sheet?.scene.light || undefined}>
      <Surroundings spec={spec} />
      <div
        className="ed-canvas"
        ref={canvas}
        tabIndex={-1}
        role="application"
        aria-label="Лист дня"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={edit}
        onDragOver={(e) => e.preventDefault()}
        onDrop={drop}
      >
        {room.w > 0 && (
          <div
            className="ed-book"
            style={{ width: unit * leaves, height: unit * LEAF_H, margin: 'auto' }}
          >
            <div className="ed-window">
              <div
                className="ed-render"
                data-blank={(!editor.text.trim() && !editor.edits.folderName) || undefined}
                style={{ width: unit * 2, left: -offset }}
              >
                <FlatSpread spec={spec} />
              </div>
            </div>
            <div className="ed-overlay" ref={sheet} style={{ width: unit * 2, left: -offset }}>
              {weatherSlot && (
                <span
                  className="ed-slot"
                  style={{
                    left: unit * 1.64,
                    top: unit * 0.02 * LEAF_H,
                    width: unit * 0.3,
                    height: unit * 0.08 * LEAF_H,
                  }}
                >
                  погода при сохранении
                </span>
              )}
              {askPhoto && (
                <button
                  type="button"
                  className="ed-empty"
                  data-small={unit < 150 || undefined}
                  style={{
                    left: unit * 0.13,
                    top: unit * 0.28,
                    width: unit * 0.72,
                    height: unit * 0.62,
                  }}
                  onClick={editor.pickPhotos}
                >
                  <b aria-hidden="true">+</b>
                  Выбрать снимки
                </button>
              )}
              {askText && (
                <button
                  type="button"
                  className="ed-empty"
                  data-small={unit < 150 || undefined}
                  style={{
                    left: unit * 1.13,
                    top: unit * 0.5,
                    width: unit * 0.76,
                    height: unit * 0.4,
                  }}
                  onClick={() => editor.focusField('text')}
                >
                  Написать о дне
                </button>
              )}
              {hovered && outline(hovered, 'hover')}
              {selected.map((item) => outline(item, 'selected'))}
              {guides.x !== null && <i className="ed-guide-x" style={{ left: guides.x * unit }} />}
              {guides.y !== null && <i className="ed-guide-y" style={{ top: guides.y * unit }} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

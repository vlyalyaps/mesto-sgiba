import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { entryCount, monthTitle } from '../app/months';
import { formatDate } from '../render/format';
import type { DaySpec } from '../types/dayspec';
import type { MonthBlock } from './calendar';

const MIN_COLS = 3;
const MAX_COLS = 10;
const EASE = 'cubic-bezier(.22,1,.36,1)';
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function startCols() {
  return Math.min(8, Math.max(4, Math.round(window.innerWidth / 120)));
}

function keyPhoto(spec: DaySpec) {
  return spec.photos.find((p) => p.role === 'key') ?? spec.photos[0];
}

/** Небольшая неровность у каждого квадратика, как у нарисованного от руки. Зависит только от даты. */
function wobble(date: string) {
  const n = Number(date.slice(8)) * 7 + Number(date.slice(5, 7)) * 3;
  const r = (k: number) => 3 + ((n * k) % 7);
  return {
    borderRadius: `${r(1)}px ${r(3)}px ${r(5)}px ${r(2)}px`,
    '--tilt': `${(((n * 5) % 9) - 4) * 0.3}deg`,
  } as CSSProperties;
}

/**
 * Сетка дней как галерея на телефоне: щипок (или Ctrl + колесо, или кнопки) меняет число колонок,
 * квадратики плавно перестраиваются, а день под пальцами остаётся на месте.
 */
export function DayGrid({
  blocks,
  today,
  scroller,
  onOpen,
}: {
  blocks: MonthBlock[];
  today: string;
  scroller: RefObject<HTMLDivElement | null>;
  onOpen: () => void;
}) {
  const [cols, setCols] = useState(startCols);
  const list = useRef<HTMLDivElement>(null);
  const snapshot = useRef<{
    rects: Map<string, DOMRect>;
    anchor: { key: string; top: number } | null;
  } | null>(null);

  function changeCols(next: number, at?: { x: number; y: number }) {
    next = Math.min(MAX_COLS, Math.max(MIN_COLS, next));
    if (next === cols || !list.current) return;
    const rects = new Map<string, DOMRect>();
    let anchor: { key: string; top: number } | null = null;
    let best = Infinity;
    const point = at ?? { x: innerWidth / 2, y: innerHeight / 2 };
    list.current.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -40 || r.top > innerHeight + 40) return;
      rects.set(el.dataset.flip!, r);
      const d = Math.hypot(r.x + r.width / 2 - point.x, r.y + r.height / 2 - point.y);
      if (d < best && el.dataset.cell) {
        best = d;
        anchor = { key: el.dataset.flip!, top: r.top };
      }
    });
    snapshot.current = { rects, anchor };
    setCols(next);
  }
  const step = useRef(changeCols);
  step.current = changeCols;

  // После перестройки: держим день под пальцами на месте и доводим квадратики из старых мест.
  useLayoutEffect(() => {
    const snap = snapshot.current;
    const root = list.current;
    snapshot.current = null;
    if (!snap || !root) return;
    const find = (key: string) => root.querySelector<HTMLElement>(`[data-flip="${key}"]`);
    if (snap.anchor && scroller.current) {
      const el = find(snap.anchor.key);
      if (el) scroller.current.scrollTop += el.getBoundingClientRect().top - snap.anchor.top;
    }
    if (calm()) return;
    snap.rects.forEach((old, key) => {
      const el = find(key);
      if (!el) return;
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      const s = old.width / now.width;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.01) return;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${s}, ${old.height / now.height})` }, {}],
        { duration: 380, easing: EASE },
      );
    });
  }, [cols, scroller]);

  // Щипок двумя пальцами, Ctrl + колесо (щипок на тачпаде) и жест Safari.
  useEffect(() => {
    const el = scroller.current;
    const inner = list.current;
    if (!el || !inner) return;
    let base = 0;
    let wheel = 0;
    const touches = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      return {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        mid: { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 },
      };
    };
    const stretch = (r: number, mid: { x: number; y: number }) => {
      if (calm()) return;
      const rect = inner.getBoundingClientRect();
      inner.style.transformOrigin = `${mid.x - rect.left}px ${mid.y - rect.top}px`;
      inner.style.transform = r === 1 ? '' : `scale(${Math.min(1.12, Math.max(0.9, r))})`;
    };
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) base = touches(e).dist;
    };
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !base) return;
      e.preventDefault();
      const { dist, mid } = touches(e);
      const r = dist / base;
      if (r > 1.2 || r < 0.83) {
        stretch(1, mid);
        step.current(cols + (r > 1 ? -1 : 1), mid);
        base = dist;
      } else stretch(r, mid);
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2 && base) {
        base = 0;
        inner.style.transform = '';
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      wheel += e.deltaY;
      if (Math.abs(wheel) > 36) {
        step.current(cols + Math.sign(wheel), { x: e.clientX, y: e.clientY });
        wheel = 0;
      }
    };
    const gesture = (e: Event) => e.preventDefault();
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', gesture);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', gesture);
    };
  }, [cols, scroller]);

  return (
    <>
      <div className="g-months" ref={list} style={{ '--cols': cols } as CSSProperties}>
        {blocks.map((block) => {
          const count = block.cells.reduce((n, c) => n + c.specs.length, 0);
          return (
            <section key={block.month} className="g-month" aria-label={monthTitle(block.month)}>
              <h2 data-flip={'m' + block.month}>
                {monthTitle(block.month)} <span>{block.month.slice(0, 4)}</span>
                <small>{count ? entryCount(count) : 'пока пусто'}</small>
              </h2>
              <ol className="g-days">
                {block.cells.map((cell) => {
                  const spec = cell.specs[0];
                  const photo = spec && keyPhoto(spec);
                  return (
                    <li
                      key={cell.date}
                      data-flip={cell.date}
                      data-cell
                      className="g-cell"
                      data-filled={spec ? true : undefined}
                      data-today={cell.date === today || undefined}
                      style={
                        {
                          ...wobble(cell.date),
                          '--tint': spec?.duo[1],
                          '--deep': spec?.duo[0],
                        } as CSSProperties
                      }
                    >
                      {spec ? (
                        <a
                          href={'#/gallery/' + spec.id}
                          data-day={spec.id}
                          onClick={onOpen}
                          aria-label={`${formatDate(cell.date)}: ${spec.folderName}`}
                        >
                          {photo && (
                            <img
                              src={photo.src}
                              alt=""
                              draggable={false}
                              loading="lazy"
                              style={{
                                objectPosition: `${(photo.crop.x + photo.crop.w / 2) * 100}% ${(photo.crop.y + photo.crop.h / 2) * 100}%`,
                              }}
                            />
                          )}
                          <span className="g-label">
                            <b>{cell.day}</b>
                            <span>{spec.folderName}</span>
                          </span>
                          {cell.specs.length > 1 && (
                            <i className="g-more">+{cell.specs.length - 1}</i>
                          )}
                        </a>
                      ) : (
                        <span className="g-label">
                          <b>{cell.day}</b>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
      <div className="g-zoom" role="group" aria-label="Размер дней">
        <button
          type="button"
          onClick={() => changeCols(cols + 1)}
          disabled={cols >= MAX_COLS}
          aria-label="Мельче"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => changeCols(cols - 1)}
          disabled={cols <= MIN_COLS}
          aria-label="Крупнее"
        >
          +
        </button>
      </div>
    </>
  );
}

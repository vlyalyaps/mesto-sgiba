import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { entryCount, monthTitle } from '../app/months';
import { warmPreview } from '../audio/itunes';
import { formatDate } from '../render/format';
import type { DaySpec } from '../types/dayspec';
import { compact, type MonthBlock } from './calendar';
import { dayGlow } from './glow';

const MIN_COLS = 3;
const MAX_COLS = 10;
const EASE = 'cubic-bezier(.32,.72,0,1)';
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** На телефоне три отпечатка в ряд — подпись ещё читается; на большом экране неделя. */
function startCols() {
  return Math.min(7, Math.max(3, Math.round(window.innerWidth / 150)));
}

function keyPhoto(spec: DaySpec) {
  return spec.photos.find((p) => p.role === 'key') ?? spec.photos[0];
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
        { duration: 460, easing: EASE },
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
    // Пока пальцы между шагами, сетка чуть тянется за ними — щипок чувствуется сразу.
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

  let order = 0;
  return (
    <>
      <div
        className="g-months"
        ref={list}
        style={{ '--cols': cols } as CSSProperties}
        data-dense={cols >= 7 || undefined}
      >
        {blocks.map((block) => {
          const count = block.cells.reduce((n, c) => n + c.specs.length, 0);
          return (
            <section key={block.month} className="g-month" aria-label={monthTitle(block.month)}>
              <h2 data-flip={'m' + block.month}>
                <span className="g-month-name">{monthTitle(block.month)}</span>
                <span className="g-month-year">{block.month.slice(0, 4)}</span>
                <span className="g-month-count">{count ? entryCount(count) : 'тихий месяц'}</span>
              </h2>
              <ol className="g-days">
                {compact(block.cells, today).map((item) => {
                  const k = Math.min(order++, 40);
                  if (item.kind === 'gap')
                    return (
                      <li
                        key={item.from.date}
                        data-flip={item.from.date}
                        data-cell
                        className="g-cell g-gap"
                        style={{ '--k': k } as CSSProperties}
                        aria-label={`${formatDate(item.from.date)} — ${formatDate(item.to.date)}: без записей`}
                      >
                        <b className="g-num">
                          {item.from.day}–{item.to.day}
                        </b>
                        <span className="g-gap-note" aria-hidden="true">
                          без записей
                        </span>
                      </li>
                    );
                  const { cell } = item;
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
                          '--k': k,
                          '--tint': spec && dayGlow(spec),
                          // Отпечатки вклеены от руки: у каждого свой небольшой наклон.
                          '--r': `${(((cell.day * 7) % 5) - 2) * 0.8}deg`,
                        } as CSSProperties
                      }
                    >
                      {spec ? (
                        <a
                          href={'#/gallery/' + spec.id}
                          data-day={spec.id}
                          onClick={onOpen}
                          onPointerDown={() => warmPreview(spec.song?.trackId)}
                          aria-label={`${formatDate(cell.date)}: ${spec.folderName}`}
                        >
                          {photo && (
                            <img
                              src={photo.src}
                              alt=""
                              draggable={false}
                              loading="lazy"
                              decoding="async"
                              style={{
                                objectPosition: `${(photo.crop.x + photo.crop.w / 2) * 100}% ${(photo.crop.y + photo.crop.h / 2) * 100}%`,
                              }}
                            />
                          )}
                          <b className="g-num">{cell.day}</b>
                          <span className="g-name">{spec.folderName}</span>
                          {cell.specs.length > 1 && (
                            <i className="g-more">+{cell.specs.length - 1}</i>
                          )}
                        </a>
                      ) : (
                        <b className="g-num">{cell.day}</b>
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
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 10h10" />
          </svg>
        </button>
        <span aria-hidden="true">
          {Array.from({ length: MAX_COLS - MIN_COLS + 1 }, (_, i) => (
            <i key={i} data-on={MAX_COLS - i <= cols || undefined} />
          ))}
        </span>
        <button
          type="button"
          onClick={() => changeCols(cols - 1)}
          disabled={cols <= MIN_COLS}
          aria-label="Крупнее"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 10h10M10 5v10" />
          </svg>
        </button>
      </div>
    </>
  );
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { DaySpread } from '../render/DaySpread';
import { formatDate } from '../render/format';
import { useAssembly } from '../render/useAssembly';
import type { DaySpec } from '../types/dayspec';

/** Градусов между соседними днями на кольце; то же число стоит в gallery.css. */
const STEP = 30;
/** Сколько соседей с каждой стороны рисуем целиком. */
const NEAR = 2;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function StaticPage({ spec }: { spec: DaySpec }) {
  const times = useMemo(() => spec.page.elements.map(() => 0), [spec]);
  return <DaySpread spec={spec} at={Infinity} times={times} />;
}

/** Передний день: живая страница, сборка по долям и звук. */
function FrontPage({
  spec,
  assemble,
  slot,
}: {
  spec: DaySpec;
  assemble: boolean;
  slot: HTMLElement | null;
}) {
  const show = useAssembly(spec);
  // Пришли свайпом — страница уже собрана, как её было видно сбоку. Собираем заново только по просьбе.
  const [started, setStarted] = useState(assemble);
  const song = spec.song;
  const busy = show.mode === 'playing' || show.mode === 'loading';
  return (
    <>
      <DaySpread spec={spec} at={started ? show.at : Infinity} times={show.times} />
      {slot &&
        createPortal(
          <div className="g-sound" data-playing={show.mode === 'playing' || undefined}>
            <div className="g-sound-meta">
              {song && (
                <>
                  <b>{song.title}</b>
                  <span>
                    {song.artist}
                    {song.year ? ` · ${song.year}` : ''}
                  </span>
                </>
              )}
              {song?.trackViewUrl && (
                <a href={song.trackViewUrl} target="_blank" rel="noreferrer">
                  ♫ Apple Music ↗ <small>provided courtesy of iTunes</small>
                </a>
              )}
              {show.notice && <span role="status">{show.notice}</span>}
            </div>
            <button
              type="button"
              className="g-replay"
              onClick={() => {
                setStarted(true);
                show.silent();
              }}
              aria-label="Собрать страницу без звука"
            >
              ↻
            </button>
            {song && (song.trackId || song.previewUrl) && (
              <button
                type="button"
                className="g-sound-button"
                data-loading={show.mode === 'loading' || undefined}
                onClick={() => {
                  setStarted(true);
                  void show.sound();
                }}
                aria-label={busy ? 'Остановить звук' : `Открыть со звуком: ${song.title}`}
              >
                <svg viewBox="0 0 48 48" aria-hidden="true">
                  {busy ? (
                    <path d="M17 16h5v16h-5zM27 16h5v16h-5z" />
                  ) : (
                    <path d="M15 31a4 3.4 0 1 0 6 0V17l13-3v14a4 3.4 0 1 0 6 0V9l-19 4.5" />
                  )}
                </svg>
              </button>
            )}
            <i className="g-note g-note-1" aria-hidden="true">
              ♪
            </i>
            <i className="g-note g-note-2" aria-hidden="true">
              ♫
            </i>
          </div>,
          slot,
        )}
    </>
  );
}

/** Ромбы-искры на разной глубине: дальние мельче, бледнее и размытее — воздушная перспектива. */
const SPARKS = [
  { x: 9, y: 16, z: 0.95 },
  { x: 86, y: 11, z: 0.4 },
  { x: 5, y: 70, z: 0.6 },
  { x: 93, y: 56, z: 0.85 },
  { x: 27, y: 90, z: 0.25 },
  { x: 72, y: 88, z: 0.5 },
  { x: 48, y: 5, z: 0.15 },
  { x: 20, y: 40, z: 0.08 },
  { x: 80, y: 32, z: 0.05 },
  { x: 62, y: 20, z: 0.12 },
  { x: 38, y: 74, z: 0.1 },
];

export function DayStage({
  days,
  index,
  firstId,
  rootRef,
  onIndex,
  onClose,
}: {
  days: DaySpec[];
  index: number;
  firstId: string;
  rootRef: RefObject<HTMLDivElement | null>;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const scene = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const depth = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const pos = useRef(index);
  const painted = useRef(-1);
  const frame = useRef(0);
  /** Куда сейчас едет кольцо: стрелки, нажатые во время поворота, считают от этой цели. */
  const aim = useRef(index);
  const width = useRef(320);
  const latest = useRef({ index, days, onIndex });
  latest.current = { index, days, onIndex };
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    start: number;
    moved: boolean;
    samples: { x: number; t: number }[];
  } | null>(null);
  const front = days[index];

  /** Кольцо поворачивается на p, дальние дни тонут в цвете фона, искры смещаются по глубине. */
  const apply = useCallback(
    (p: number) => {
      const { days } = latest.current;
      ring.current?.style.setProperty('--pos', p.toFixed(4));
      ring.current?.querySelectorAll<HTMLElement>(':scope > .g-card').forEach((card, i) => {
        const d = Math.abs(i - p);
        card.style.setProperty('--fog', Math.min(d * 0.45, 0.9).toFixed(3));
        card.style.visibility = d > NEAR + 0.6 ? 'hidden' : '';
      });
      depth.current?.style.setProperty('--pan', p.toFixed(4));
      const near = Math.min(days.length - 1, Math.max(0, Math.round(p)));
      if (near !== painted.current && days[near] && rootRef.current) {
        painted.current = near;
        // Цвет дня — выраженная краска его снимков (ink), края — их тени.
        rootRef.current.style.setProperty('--sky-a', days[near].ink);
        rootRef.current.style.setProperty('--sky-b', days[near].duo[0]);
      }
    },
    [rootRef],
  );

  const go = useCallback(
    (target: number) => {
      const { days } = latest.current;
      target = Math.min(days.length - 1, Math.max(0, target));
      aim.current = target;
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      const finish = () => {
        frame.current = 0;
        if (target !== latest.current.index) latest.current.onIndex(target);
      };
      const from = pos.current;
      const dist = Math.abs(target - from);
      if (calm() || dist < 0.001) {
        pos.current = target;
        apply(target);
        finish();
        return;
      }
      const duration = 380 + Math.min(dist, 3) * 140;
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        pos.current = from + (target - from) * (1 - Math.pow(1 - t, 4));
        apply(pos.current);
        if (t < 1) frame.current = requestAnimationFrame(tick);
        else finish();
      };
      frame.current = requestAnimationFrame(tick);
    },
    [apply],
  );

  // Радиус кольца от ширины карточки: соседи стоят рядом, но не наезжают.
  useLayoutEffect(() => {
    const el = scene.current;
    if (!el) return;
    const measure = () => {
      const card = ring.current?.querySelector<HTMLElement>('.g-card');
      width.current = card?.offsetWidth ?? 320;
      const r = (width.current * 0.53) / Math.sin(((STEP / 2) * Math.PI) / 180);
      ring.current?.style.setProperty('--r', r.toFixed(1) + 'px');
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // Новый список или день снаружи — ставим кольцо на место, если его сейчас не крутят.
  useLayoutEffect(() => {
    if (frame.current || drag.current?.moved) return;
    aim.current = index;
    pos.current = index;
    apply(index);
  }, [index, days, apply]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') go(aim.current - 1);
      else if (e.key === 'ArrowRight') go(aim.current + 1);
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, onClose]);

  function down(e: ReactPointerEvent) {
    if (e.button !== 0 || (e.target as Element).closest('button, a, [role="dialog"]')) return;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      start: pos.current,
      moved: false,
      samples: [{ x: e.clientX, t: e.timeStamp }],
    };
  }

  function move(e: ReactPointerEvent) {
    const d = drag.current;
    const el = scene.current!;
    if (!d || d.id !== e.pointerId) {
      // Мышь слегка поворачивает передний лист к себе.
      if (e.pointerType !== 'mouse' || calm()) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--tx', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
      el.style.setProperty('--ty', (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      d.moved = true;
      el.setPointerCapture(e.pointerId);
      el.dataset.dragging = '';
    }
    const last = latest.current.days.length - 1;
    let p = d.start - dx / (width.current * 1.05);
    // У крайних дней кольцо пружинит, а не обрывается.
    if (p < 0) p = -(-p * 0.35) / (1 + -p * 0.6);
    if (p > last) p = last + ((p - last) * 0.35) / (1 + (p - last) * 0.6);
    pos.current = p;
    apply(p);
    d.samples = [...d.samples.slice(-4), { x: e.clientX, t: e.timeStamp }];
  }

  function up(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    delete scene.current!.dataset.dragging;
    if (!d.moved) {
      // Касание соседнего дня поворачивает кольцо к нему.
      const card = (e.target as Element).closest<HTMLElement>('.g-card');
      const i = Number(card?.dataset.i);
      if (card && i !== latest.current.index) go(i);
      return;
    }
    // Чтобы отпущенный палец не нажал на фото под ним.
    const swallow = (c: Event) => c.stopPropagation();
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    const a = d.samples[0];
    const b = d.samples[d.samples.length - 1];
    const v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
    // Рывок — ровно на один день в сторону рывка; медленное перетаскивание — куда отпустили.
    const flick = Math.abs(v) > 0.35 && Math.abs(pos.current - d.start) < 1;
    go(flick ? Math.round(d.start) - Math.sign(v) : Math.round(pos.current));
  }

  function cancel() {
    if (!drag.current) return;
    const moved = drag.current.moved;
    drag.current = null;
    delete scene.current?.dataset.dragging;
    if (moved) go(Math.round(pos.current));
  }

  function leave() {
    scene.current?.style.setProperty('--tx', '0');
    scene.current?.style.setProperty('--ty', '0');
  }

  return (
    <div className="g-stage" ref={rootRef}>
      <div className="g-sky" aria-hidden="true" />
      <div className="g-depth" ref={depth} aria-hidden="true">
        <i className="g-haze g-haze-1" />
        <i className="g-haze g-haze-2" />
        {SPARKS.map((s, i) => (
          <svg
            key={i}
            className="g-spark"
            viewBox="0 0 20 40"
            style={{ left: s.x + '%', top: s.y + '%', '--z': s.z, '--d': i } as CSSProperties}
          >
            <path d="M10 1C11.6 14 14.6 18 19 20 14.6 22 11.6 26 10 39 8.4 26 5.4 22 1 20 5.4 18 8.4 14 10 1Z" />
          </svg>
        ))}
      </div>
      <div
        className="g-scene"
        ref={scene}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onPointerLeave={leave}
      >
        <div className="g-ring" ref={ring}>
          {days.map((d, i) => {
            const isFront = i === index;
            return (
              <div
                key={d.id}
                className="g-card"
                data-i={i}
                data-front={isFront || undefined}
                aria-hidden={!isFront || undefined}
                style={{ '--i': i } as CSSProperties}
              >
                <div className="g-float">
                  <div className="g-tilt">
                    <div className="g-lift">
                      <div className="g-page" inert={!isFront}>
                        {Math.abs(i - index) <= NEAR &&
                          (isFront ? (
                            <FrontPage
                              key={d.id}
                              spec={d}
                              assemble={d.id === firstId}
                              slot={slot}
                            />
                          ) : (
                            <StaticPage spec={d} />
                          ))}
                      </div>
                      <i className="g-fog" aria-hidden="true" />
                    </div>
                    <i className="g-shadow" aria-hidden="true" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <header className="g-stage-bar">
        <button type="button" className="g-chip" onClick={onClose}>
          ← Дни
        </button>
        <div className="g-title" aria-live="polite">
          <time dateTime={front.date}>
            {formatDate(front.date)} {front.date.slice(0, 4)}
          </time>
          <h1>{front.folderName}</h1>
        </div>
        <a className="g-chip" href={'#/day/' + front.id}>
          В книге ↗
        </a>
      </header>

      <button
        type="button"
        className="g-arrow g-prev"
        onClick={() => go(aim.current - 1)}
        disabled={index === 0}
        aria-label="Предыдущий день"
      >
        ‹
      </button>
      <button
        type="button"
        className="g-arrow g-next"
        onClick={() => go(aim.current + 1)}
        disabled={index === days.length - 1}
        aria-label="Следующий день"
      >
        ›
      </button>
      <p className="g-count">
        {index + 1} / {days.length}
        <span> · листай в стороны</span>
      </p>
      <div className="g-sound-slot" ref={setSlot} />
    </div>
  );
}

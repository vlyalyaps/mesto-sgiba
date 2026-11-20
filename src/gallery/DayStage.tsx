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

/** Сколько градусов поворота даёт протяжка пальцем на всю ширину листа. */
const DRAG_DEG = 200;
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
  // Пришли свайпом — страница уже собрана, как её было видно на обороте. Собираем заново по просьбе.
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

/**
 * День — один лист в пространстве. Свайп поворачивает его вокруг своей оси: за ребром (90°)
 * на обороте уже соседний день, и фон перетекает в его цвет.
 */
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
  const card = useRef<HTMLDivElement>(null);
  const depth = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  /** Куда смотрит оборот: +1 — следующий день (свайп влево), −1 — предыдущий. */
  const [side, setSide] = useState<1 | -1>(1);
  const angle = useRef(0);
  const frame = useRef(0);
  const painted = useRef('');
  const latest = useRef({ index, days, onIndex, side });
  latest.current = { index, days, onIndex, side };
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    start: number;
    moved: boolean;
    samples: { x: number; t: number }[];
  } | null>(null);
  const front = days[index];
  const back = days[index + side];

  /** Лист повёрнут на a градусов. Отрицательный угол — свайп влево, к следующему дню. */
  const apply = useCallback(
    (a: number) => {
      const { index, days, side } = latest.current;
      const dir: 1 | -1 = a < 0 ? 1 : a > 0 ? -1 : side;
      if (dir !== side) {
        latest.current.side = dir;
        setSide(dir);
      }
      const turn = Math.min(1, Math.abs(a) / 180);
      const lift = Math.abs(Math.sin((a * Math.PI) / 180));
      card.current?.style.setProperty('--spin', a.toFixed(2) + 'deg');
      card.current?.style.setProperty('--lift', lift.toFixed(3));
      // Искры пролетают мимо на развороте и к концу возвращаются на места.
      depth.current?.style.setProperty('--pan', (dir * Math.sin(turn * Math.PI)).toFixed(3));
      const shown = days[turn >= 0.5 ? index + dir : index] ?? days[index];
      if (shown && shown.id !== painted.current && rootRef.current) {
        painted.current = shown.id;
        // Цвет дня — выраженная краска его снимков (ink), края — их тени.
        rootRef.current.style.setProperty('--sky-a', shown.ink);
        rootRef.current.style.setProperty('--sky-b', shown.duo[0]);
      }
    },
    [rootRef],
  );

  /** Доводит поворот до угла target; done — после остановки. */
  const spinTo = useCallback(
    (target: number, done?: () => void) => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      const from = angle.current;
      const dist = Math.abs(target - from);
      const finish = () => {
        frame.current = 0;
        done?.();
      };
      if (calm() || dist < 0.5) {
        angle.current = target;
        apply(target);
        finish();
        return;
      }
      const duration = 240 + (dist / 180) * 460;
      const t0 = performance.now();
      // С места — плавный разгон и торможение; после пальца — только торможение.
      const ease =
        from === 0 ? (t: number) => t * t * (3 - 2 * t) : (t: number) => 1 - (1 - t) ** 3;
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        angle.current = from + (target - from) * ease(t);
        apply(angle.current);
        if (t < 1) frame.current = requestAnimationFrame(tick);
        else finish();
      };
      frame.current = requestAnimationFrame(tick);
    },
    [apply],
  );

  /** Перевернуть лист к соседнему дню: dir = +1 следующий, −1 предыдущий. */
  const flip = useCallback(
    (dir: 1 | -1) => {
      const { index, days } = latest.current;
      if (frame.current || drag.current?.moved || !days[index + dir]) return;
      latest.current.side = dir;
      setSide(dir);
      spinTo(dir === 1 ? -180 : 180, () => latest.current.onIndex(index + dir));
    },
    [spinTo],
  );

  // Новый передний день: оборот стал лицом, лист снова в нуле — глазу ничего не видно.
  useLayoutEffect(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    angle.current = 0;
    painted.current = '';
    apply(0);
  }, [index, days, apply]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') flip(-1);
      else if (e.key === 'ArrowRight') flip(1);
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [flip, onClose]);

  function down(e: ReactPointerEvent) {
    if (e.button !== 0 || frame.current) return;
    if ((e.target as Element).closest('button, a, [role="dialog"]')) return;
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      start: angle.current,
      moved: false,
      samples: [{ x: e.clientX, t: e.timeStamp }],
    };
  }

  function move(e: ReactPointerEvent) {
    const d = drag.current;
    const el = scene.current!;
    if (!d || d.id !== e.pointerId) {
      // Мышь слегка поворачивает лист к себе.
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
    const width = card.current?.offsetWidth ?? 320;
    let a = d.start + (dx / width) * DRAG_DEG;
    const { index, days } = latest.current;
    // За крайним днём листа нет: лист только пружинит.
    if (!days[index + (a < 0 ? 1 : -1)]) a = Math.sign(a) * 26 * (1 - Math.exp(-Math.abs(a) / 60));
    a = Math.max(-180, Math.min(180, a));
    angle.current = a;
    apply(a);
    d.samples = [...d.samples.slice(-4), { x: e.clientX, t: e.timeStamp }];
  }

  function up(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    delete scene.current!.dataset.dragging;
    if (!d.moved) return;
    // Чтобы отпущенный палец не нажал на фото под ним.
    const swallow = (c: Event) => c.stopPropagation();
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    const a = angle.current;
    const dir: 1 | -1 = a < 0 ? 1 : -1;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const v = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
    const { index, days } = latest.current;
    // Рывок решает по своему направлению, медленная протяжка — довели ли лист за ребро (90°).
    const turn =
      !!days[index + dir] &&
      (Math.abs(v) > 0.35 ? Math.sign(v) === Math.sign(a) : Math.abs(a) > 90);
    if (turn) spinTo(dir === 1 ? -180 : 180, () => latest.current.onIndex(index + dir));
    else spinTo(0);
  }

  function cancel() {
    if (!drag.current) return;
    const moved = drag.current.moved;
    drag.current = null;
    delete scene.current?.dataset.dragging;
    if (moved) spinTo(0);
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
        <div className="g-card" ref={card}>
          <div className="g-float">
            <div className="g-tilt">
              <div className="g-lift">
                <div className="g-spin">
                  <section className="g-face" aria-label={front.folderName}>
                    <div className="g-page">
                      <FrontPage
                        key={front.id}
                        spec={front}
                        assemble={front.id === firstId}
                        slot={slot}
                      />
                    </div>
                    <i className="g-shade" aria-hidden="true" />
                  </section>
                  <div className="g-face g-face-back" aria-hidden="true" inert>
                    <div className="g-page">{back && <StaticPage key={back.id} spec={back} />}</div>
                    <i className="g-shade" />
                  </div>
                </div>
              </div>
              <i className="g-shadow" aria-hidden="true" />
            </div>
          </div>
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
        onClick={() => flip(-1)}
        disabled={index === 0}
        aria-label="Предыдущий день"
      >
        ‹
      </button>
      <button
        type="button"
        className="g-arrow g-next"
        onClick={() => flip(1)}
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

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
import { moodLabel } from '../render/stickers/Sticker';
import { useAssembly } from '../render/useAssembly';
import type { DaySpec, Mood, WeatherSnapshot } from '../types/dayspec';
import { Equalizer, Orbits, Sparkle } from './glyphs';
import { beatSeconds, dayGlow } from './glow';
import { Starfield, type FieldMotion } from './Starfield';

/** Сколько градусов поворота даёт протяжка пальцем на всю ширину листа. */
const DRAG_DEG = 200;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Сильный ease-in-out для поворота по кнопке: силы пальца нет — нет и отскока. */
const inOut = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

function StaticPage({ spec }: { spec: DaySpec }) {
  const times = useMemo(() => spec.page.elements.map(() => 0), [spec]);
  return <DaySpread spec={spec} at={Infinity} times={times} />;
}

/** Передний день: живая страница, сборка по долям и звук. */
function FrontPage({
  spec,
  assemble,
  slot,
  onPlaying,
}: {
  spec: DaySpec;
  assemble: boolean;
  slot: HTMLElement | null;
  onPlaying: (on: boolean) => void;
}) {
  const show = useAssembly(spec);
  // Пришли свайпом — страница уже собрана, как её было видно на обороте. Собираем заново по просьбе.
  const [started, setStarted] = useState(assemble);
  const song = spec.song;
  const busy = show.mode === 'playing' || show.mode === 'loading';
  const playing = show.mode === 'playing';
  useEffect(() => {
    onPlaying(playing);
    return () => onPlaying(false);
  }, [playing, onPlaying]);
  return (
    <>
      <DaySpread spec={spec} at={started ? show.at : Infinity} times={show.times} />
      {slot &&
        createPortal(
          <div className="g-sound" data-state={show.mode}>
            {song && (song.trackId || song.previewUrl) && (
              <button
                type="button"
                className="g-play"
                onClick={() => {
                  setStarted(true);
                  void show.sound();
                }}
                aria-label={busy ? 'Остановить звук' : `Открыть день со звуком: ${song.title}`}
              >
                <Equalizer />
                <span>{busy ? (playing ? 'Стоп' : 'Загрузка') : 'Слушать день'}</span>
              </button>
            )}
            <button
              type="button"
              className="g-ghost"
              onClick={() => {
                setStarted(true);
                show.silent();
              }}
              aria-label="Собрать страницу заново без звука"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v3.6h-3.6" />
              </svg>
            </button>
            {song && (
              <div className="g-credit">
                <b>{song.title}</b>
                <span>
                  {song.artist}
                  {song.year ? ` · ${song.year}` : ''}
                </span>
                {song.trackViewUrl && (
                  <a href={song.trackViewUrl} target="_blank" rel="noreferrer">
                    Apple Music ↗ <small>provided courtesy of iTunes</small>
                  </a>
                )}
              </div>
            )}
            {show.notice && (
              <p className="g-notice" role="status">
                {show.notice}
              </p>
            )}
          </div>,
          slot,
        )}
    </>
  );
}

/** Искры-ромбы вокруг листа: z — глубина, дальние мельче и размытее. */
const SPARKS = [
  { x: 14, y: 22, z: 0.9 },
  { x: 80, y: 14, z: 0.45 },
  { x: 90, y: 62, z: 0.8 },
  { x: 58, y: 86, z: 0.3 },
  { x: 36, y: 70, z: 0.15 },
  { x: 66, y: 32, z: 0.1 },
  { x: 24, y: 48, z: 0.55 },
];

function keyPhoto(spec: DaySpec) {
  return spec.photos.find((p) => p.role === 'key') ?? spec.photos[0];
}

function facts(spec: DaySpec) {
  let mood: Mood | undefined;
  let weather: WeatherSnapshot | undefined;
  for (const e of spec.page.elements) {
    if (e.kind === 'mood') mood = e.mood;
    if (e.kind === 'weather') weather = e.weather;
  }
  return [
    mood && moodLabel(mood),
    weather && `${Math.round(weather.tempC)}° · ${weather.place}`,
    spec.song && `♫ ${spec.song.title}`,
  ].filter((f): f is string => !!f);
}

/**
 * День — один лист в тёмном пространстве. Свайп поворачивает его вокруг своей оси: за ребром
 * (90°) на обороте уже соседний день, свечение за листом перетекает в его цвет.
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
  const tilt = useRef<HTMLDivElement>(null);
  const spin = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLElement>(null);
  const sparks = useRef<HTMLDivElement>(null);
  const motion = useRef<FieldMotion>({ pan: 0 });
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  /** День на обороте листа. */
  const [peer, setPeer] = useState(() => (days[index + 1] ? index + 1 : index - 1));
  /** День, который сейчас видно: меняется, когда лист проходит ребро. */
  const [shown, setShown] = useState(index);
  const angle = useRef(0);
  const frame = useRef(0);
  const latest = useRef({ index, days, onIndex, peer, shown });
  latest.current = { ...latest.current, index, days, onIndex };
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    start: number;
    moved: boolean;
    samples: { x: number; t: number }[];
  } | null>(null);
  const front = days[index];
  const back = days[peer];
  const visible = days[shown] ?? front;
  const glow = dayGlow(visible);

  const paint = useCallback(
    (day: DaySpec) => {
      rootRef.current?.style.setProperty('--glow', dayGlow(day));
      rootRef.current?.style.setProperty('--shade', day.duo[0]);
    },
    [rootRef],
  );

  /** Ставит лист на угол a. Всё, что зависит от угла, пишется прямо в transform, без React. */
  const apply = useCallback(
    (a: number) => {
      const state = latest.current;
      if (drag.current?.moved && a !== 0) {
        const want = a < 0 ? state.index + 1 : state.index - 1;
        if (want !== state.peer && state.days[want]) {
          state.peer = want;
          setPeer(want);
        }
      }
      const turn = Math.min(1, Math.abs(a) / 180);
      const lift = Math.abs(Math.sin((a * Math.PI) / 180));
      if (spin.current)
        spin.current.style.transform = `translate3d(0,0,${(-lift * 120).toFixed(1)}px) rotateY(${a.toFixed(2)}deg)`;
      spin.current?.querySelectorAll<HTMLElement>('.g-shade').forEach((el) => {
        el.style.opacity = (lift * 0.6).toFixed(3);
      });
      spin.current?.querySelectorAll<HTMLElement>('.g-sheen').forEach((el) => {
        el.style.opacity = (lift * 0.9).toFixed(3);
        el.style.transform = `translateX(${((-a / 180) * 260).toFixed(1)}%)`;
      });
      if (shadow.current) {
        shadow.current.style.transform = `translateZ(-80px) scaleX(${(1 - lift * 0.72).toFixed(3)})`;
        shadow.current.style.opacity = (1 - lift * 0.45).toFixed(3);
      }
      const sign = a < 0 ? 1 : -1;
      const pan = a === 0 ? 0 : sign * Math.sin(turn * Math.PI);
      motion.current.pan = pan;
      sparks.current?.querySelectorAll<SVGElement>('.g-sparkle').forEach((el) => {
        const z = Number(el.dataset.z);
        el.style.translate = `${(-pan * (16 + z * 150)).toFixed(1)}px 0`;
      });
      const now = turn >= 0.5 ? state.peer : state.index;
      if (now !== state.shown && state.days[now]) {
        state.shown = now;
        setShown(now);
        paint(state.days[now]);
      }
    },
    [paint],
  );

  const stop = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  };

  /** Отпущенный палец: пружина с его скоростью (°/с), без пальца — плавный поворот. */
  const settle = useCallback(
    (target: number, velocity: number | null, done?: () => void) => {
      stop();
      const finish = () => {
        frame.current = 0;
        angle.current = target;
        apply(target);
        done?.();
      };
      if (calm()) return finish();
      const from = angle.current;
      let x = from;
      let v = velocity ?? 0;
      const t0 = performance.now();
      let last = t0;
      const duration = 520 + (Math.abs(target - from) / 180) * 260;
      const tick = (now: number) => {
        if (velocity === null) {
          const t = Math.min(1, (now - t0) / duration);
          x = from + (target - from) * inOut(t);
          angle.current = x;
          apply(x);
          if (t < 1) frame.current = requestAnimationFrame(tick);
          else finish();
          return;
        }
        // Пружина: жёсткость 190, затухание чуть меньше критического — едва заметный дожим.
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        const k = 190;
        const c = 2 * Math.sqrt(k) * 0.86;
        for (let i = 0; i < 4; i++) {
          v += (-k * (x - target) - c * v) * (dt / 4);
          x += v * (dt / 4);
        }
        angle.current = x;
        apply(x);
        if (Math.abs(x - target) < 0.1 && Math.abs(v) < 3) finish();
        else frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [apply],
  );

  /** Повернуть лист к любому дню: оборот сразу показывает его. */
  const flipTo = useCallback(
    (i: number) => {
      const { index, days } = latest.current;
      if (frame.current || drag.current?.moved || i === index || !days[i]) return;
      latest.current.peer = i;
      setPeer(i);
      settle(i > index ? -180 : 180, null, () => latest.current.onIndex(i));
    },
    [settle],
  );

  // Новый передний день: оборот стал лицом, лист снова в нуле — глазу ничего не видно.
  useLayoutEffect(() => {
    stop();
    angle.current = 0;
    const next = days[index + 1] ? index + 1 : index - 1;
    latest.current.peer = next;
    latest.current.shown = index;
    setPeer(next);
    setShown(index);
    paint(days[index]);
    apply(0);
  }, [index, days, apply, paint]);

  useEffect(() => stop, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') flipTo(latest.current.index - 1);
      else if (e.key === 'ArrowRight') flipTo(latest.current.index + 1);
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [flipTo, onClose]);

  // Активный день на ленте всегда в поле зрения. Крутим только саму ленту: scrollIntoView
  // сдвинул бы и сцену, у которой overflow: hidden.
  useEffect(() => {
    const rail = rootRef.current?.querySelector<HTMLElement>('.g-rail');
    const item = rail?.querySelector<HTMLElement>(`[data-i="${shown}"]`);
    if (!rail || !item) return;
    rail.scrollTo({
      left: item.offsetLeft - rail.clientWidth / 2 + item.offsetWidth / 2,
      top: item.offsetTop - rail.clientHeight / 2 + item.offsetHeight / 2,
      behavior: calm() ? 'auto' : 'smooth',
    });
  }, [shown, rootRef]);

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
      if (e.pointerType !== 'mouse' || calm() || !tilt.current) return;
      const r = el.getBoundingClientRect();
      const tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      tilt.current.style.transform = `rotateX(${(-ty * 5).toFixed(2)}deg) rotateY(${(tx * 7).toFixed(2)}deg)`;
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
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Указатель уже отпущен — тянем без захвата.
      }
      el.dataset.dragging = '';
    }
    const width = card.current?.offsetWidth ?? 320;
    let a = d.start + (dx / width) * DRAG_DEG;
    const { index, days } = latest.current;
    // За крайним днём листа нет: лист только пружинит.
    if (!days[index + (a < 0 ? 1 : -1)]) a = Math.sign(a) * 24 * (1 - Math.exp(-Math.abs(a) / 60));
    a = Math.max(-180, Math.min(180, a));
    angle.current = a;
    apply(a);
    d.samples = [...d.samples.slice(-4), { x: e.clientX, t: e.timeStamp }];
  }

  function up(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      drag.current = null;
      return;
    }
    delete scene.current!.dataset.dragging;
    // Чтобы отпущенный палец не нажал на фото под ним.
    const swallow = (c: Event) => c.stopPropagation();
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    const a = angle.current;
    const dir = a < 0 ? 1 : -1;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const v = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
    const width = card.current?.offsetWidth ?? 320;
    const spinSpeed = ((v * 1000) / width) * DRAG_DEG;
    const { index, days } = latest.current;
    drag.current = null;
    // Рывок решает по своему направлению, медленная протяжка — довели ли лист за ребро.
    const turn =
      !!days[index + dir] &&
      (Math.abs(v) > 0.35 ? Math.sign(v) === Math.sign(a) : Math.abs(a) > 90);
    if (turn) settle(dir === 1 ? -180 : 180, spinSpeed, () => latest.current.onIndex(index + dir));
    else settle(0, spinSpeed);
  }

  function cancel() {
    if (!drag.current) return;
    const moved = drag.current.moved;
    drag.current = null;
    delete scene.current?.dataset.dragging;
    if (moved) settle(0, 0);
  }

  function leave() {
    if (tilt.current) tilt.current.style.transform = '';
  }

  const onPlaying = useCallback((on: boolean) => setPlaying(on), []);
  const words = visible.folderName.split(/\s+/);
  const ticker = [visible.folderName, ...facts(visible), formatDate(visible.date)];

  return (
    <div
      className="g-stage"
      ref={rootRef}
      data-playing={playing || undefined}
      style={{ '--beat': beatSeconds(front.reveal.beats) + 's' } as CSSProperties}
    >
      <div className="g-space" aria-hidden="true">
        <i className="g-glow" />
        <i className="g-glow g-glow-far" />
        <i className="g-vignette" />
      </div>
      <Starfield color={glow} motion={motion} />
      <div className="g-marquee" aria-hidden="true">
        <div className="g-marquee-track" key={visible.id}>
          {[0, 1].map((k) => (
            <span key={k}>
              {[...ticker, ...ticker].map((t, i) => (
                <b key={i}>{t}</b>
              ))}
            </span>
          ))}
        </div>
      </div>
      <div className="g-sparks" ref={sparks} aria-hidden="true">
        {SPARKS.map((s, i) => (
          <Sparkle
            key={i}
            style={{ left: s.x + '%', top: s.y + '%', '--z': s.z, '--d': i } as CSSProperties}
            z={s.z}
          />
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
          <Orbits />
          <div className="g-idle">
            <div className="g-tilt" ref={tilt}>
              <div className="g-lift">
                <div className="g-spin" ref={spin}>
                  <section className="g-face" aria-label={front.folderName}>
                    <div className="g-page">
                      <FrontPage
                        key={front.id}
                        spec={front}
                        assemble={front.id === firstId}
                        slot={slot}
                        onPlaying={onPlaying}
                      />
                    </div>
                    <i className="g-shade" aria-hidden="true" />
                    <i className="g-sheen" aria-hidden="true" />
                  </section>
                  <div className="g-face g-face-back" aria-hidden="true" inert>
                    <div className="g-page">{back && <StaticPage key={back.id} spec={back} />}</div>
                    <i className="g-shade" />
                    <i className="g-sheen" />
                  </div>
                </div>
              </div>
              <i className="g-shadow" ref={shadow} aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      <header className="g-top">
        <button type="button" className="g-round" onClick={onClose} aria-label="Ко всем дням">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4 6.5 10l6 6" />
          </svg>
        </button>
        <p className="g-counter" aria-live="polite">
          <b>{String(shown + 1).padStart(2, '0')}</b>
          <i style={{ '--p': (shown + 1) / days.length } as CSSProperties} />
          <span>{String(days.length).padStart(2, '0')}</span>
        </p>
        <a className="g-pill-link" href={'#/day/' + front.id}>
          В книге
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7 13 13 7M8 7h5v5" />
          </svg>
        </a>
      </header>

      <div className="g-side">
        <div className="g-copy" key={visible.id}>
          <p className="g-kicker">
            {formatDate(visible.date)} {visible.date.slice(0, 4)}
            <span> · день {String(visible.number).padStart(3, '0')}</span>
          </p>
          <h1 className="g-h1">
            {words.map((w, i) => (
              <span className="g-word" key={i}>
                <span style={{ animationDelay: `${60 + i * 55}ms` }}>{w}</span>
              </span>
            ))}
          </h1>
          <ul className="g-facts">
            {facts(visible).map((f, i) => (
              <li key={f} style={{ animationDelay: `${180 + words.length * 55 + i * 50}ms` }}>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="g-sound-slot" ref={setSlot} />
      </div>

      <nav className="g-rail" aria-label="Все дни">
        {days.map((d, i) => {
          const photo = keyPhoto(d);
          return (
            <button
              type="button"
              key={d.id}
              data-i={i}
              aria-current={i === shown || undefined}
              aria-label={`${formatDate(d.date)}: ${d.folderName}`}
              onClick={() => flipTo(i)}
              style={{ '--tint': dayGlow(d) } as CSSProperties}
            >
              {photo && <img src={photo.src} alt="" draggable={false} />}
              <span>{d.date.slice(8)}</span>
            </button>
          );
        })}
      </nav>
      <p className="g-hint" aria-hidden="true">
        <span>←</span> листай <span>→</span>
      </p>
    </div>
  );
}

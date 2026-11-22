import {
  memo,
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
import { ExportButton } from '../app/ExportButton';
import { warmPreview } from '../audio/itunes';
import { routeHref } from '../app/router';
import { SceneBackdrop } from '../render/SceneBackdrop';
import { DaySpread } from '../render/DaySpread';
import { formatDate } from '../render/format';
import { useAssembly } from '../render/useAssembly';
import type { DaySpec } from '../types/dayspec';
import { weatherFall } from '../weather/words';
import { Equalizer, Orbits, Sparkle } from './glyphs';
import { beatSeconds, dayGlow } from './glow';
import { Starfield, type FieldMotion } from './Starfield';
import { WhyNote } from './WhyNote';

/** Сколько градусов поворота даёт протяжка пальцем на всю ширину листа. */
const DRAG_DEG = 200;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Доля времени на разгон: разгон короче, торможение длиннее. */
const RISE = 0.4;
/** Путь за время разгона: при нём на стыке двух кривых скорость не прыгает. */
const RISEN = (4 * RISE) / (3 * (1 - RISE) + 4 * RISE);
/** Поворот: разгон кубом, долгое торможение четвёртой степенью. */
const turnEase = (t: number) =>
  t < RISE ? RISEN * (t / RISE) ** 3 : 1 - (1 - RISEN) * ((1 - t) / (1 - RISE)) ** 4;
/** Бросок быстрее этого (°/с) тормозит со скорости пальца, медленнее — идёт по общей кривой. */
const FLING = 200;
/** Заголовок длиннее этого набираем мельче, чтобы он держался в четырёх строках. */
const LONG_TITLE = 24;
/** Семь слов: ещё мельче, иначе кнопка звука прыгает. */
const VERY_LONG_TITLE = 34;

/**
 * День открыт самим человеком (касание клетки, перелистывание, клавиша) — тогда песня звучит
 * сразу. При открытии по ссылке звука нет, пока его не попросят. Свайп считаем с отпускания.
 */
let gestureAt = -Infinity;
for (const type of ['pointerdown', 'pointerup', 'keydown'] as const)
  window.addEventListener(type, () => (gestureAt = performance.now()), {
    capture: true,
    passive: true,
  });
const recentGesture = () => performance.now() - gestureAt < 2500;

/** Погода часа записи: в снег и дождь пыль за книгой падает. */
function fallOf(spec: DaySpec) {
  const weather = spec.page.elements.find((e) => e.kind === 'weather')?.weather;
  return weather ? weatherFall(weather.code) : null;
}

// Страницы тяжёлые: смена подписи на середине поворота не должна пересобирать их.
const StaticPage = memo(function StaticPage({ spec }: { spec: DaySpec }) {
  return <DaySpread spec={spec} />;
});

/** Передний день: живая страница, сборка по долям и звук. */
const FrontPage = memo(function FrontPage({
  spec,
  assemble,
  slot,
  autoplay,
  onPlaying,
}: {
  spec: DaySpec;
  assemble: boolean;
  slot: HTMLElement | null;
  /** Человек сам открыл день: песня звучит сразу. */
  autoplay: boolean;
  onPlaying: (on: boolean) => void;
}) {
  const song = spec.song;
  const audible = !!song && !!(song.trackId || song.previewUrl);
  // Пришли свайпом — страница уже собрана, как её было видно на обороте.
  // Открыли со звуком — сборку ведёт песня, тихая сборка не нужна.
  const show = useAssembly(spec, !assemble || (autoplay && audible));
  const sound = useRef(show.sound);
  sound.current = show.sound;
  const busy = show.mode === 'playing' || show.mode === 'loading';
  const playing = show.mode === 'playing';
  const listen = () => void show.sound();
  useEffect(() => {
    onPlaying(playing);
    return () => onPlaying(false);
  }, [playing, onPlaying]);
  useEffect(() => {
    if (!autoplay || !audible) return;
    void sound.current(assemble);
  }, [autoplay, audible, assemble]);
  return (
    <>
      <DaySpread
        spec={spec}
        root={show.root}
        assembling={show.assembling}
        playback={audible ? { toggle: listen, active: busy } : undefined}
      />
      {slot &&
        createPortal(
          <div className="g-sound" data-state={show.mode}>
            {audible && (
              <button
                type="button"
                className="g-play"
                onClick={listen}
                aria-label={busy ? 'Остановить звук' : `Открыть день со звуком: ${song.title}`}
              >
                <Equalizer />
                <span>{busy ? (playing ? 'Стоп' : 'Загрузка') : 'Слушать день'}</span>
              </button>
            )}
            <button
              type="button"
              className="g-ghost"
              onClick={() => show.silent()}
              aria-label="Собрать страницу заново без звука"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v3.6h-3.6" />
              </svg>
            </button>
            {song?.trackViewUrl && (
              <a className="g-credit" href={song.trackViewUrl} target="_blank" rel="noreferrer">
                Apple Music ↗ <small>provided courtesy of iTunes</small>
              </a>
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
});

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

/**
 * День — один лист в тёмном пространстве. Свайп поворачивает его вокруг своей оси: за ребром
 * (90°) на обороте уже соседний день, свечение за листом перетекает в его цвет.
 */
export function DayStage({
  days,
  own,
  index,
  firstId,
  rootRef,
  onIndex,
  onClose,
}: {
  days: DaySpec[];
  /** Свои дни: у них есть папка, которую можно скачать. */
  own: ReadonlySet<string>;
  index: number;
  firstId: string;
  rootRef: RefObject<HTMLDivElement | null>;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const scene = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const idle = useRef<HTMLDivElement>(null);
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
  const blur = useRef(0);
  const still = useRef(0);
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
  const backdrop = visible.page.sheet?.scene;
  const fall = fallOf(visible);
  // Решаем один раз на день: иначе любое касание потом включало бы песню снова.
  const autoplay = useMemo(() => recentGesture(), [front.id]);
  // Песни соседних дней ищем заранее. При открытии по ссылке сеть не трогаем.
  useEffect(() => {
    if (!autoplay) return;
    warmPreview(days[index + 1]?.song?.trackId);
    warmPreview(days[index - 1]?.song?.trackId);
  }, [days, index, autoplay]);

  const paint = useCallback(
    (day: DaySpec) => {
      rootRef.current?.style.setProperty('--glow', dayGlow(day));
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
      // Лист отходит ровно настолько, чтобы ближнее ребро не наезжало на зрителя и не росло.
      const depth = ((card.current?.offsetWidth ?? 0) / 2) * lift;
      if (idle.current) idle.current.style.translate = `0 0 ${(-depth).toFixed(1)}px`;
      if (spin.current) spin.current.style.transform = `rotateY(${a.toFixed(2)}deg)`;
      spin.current?.querySelectorAll<HTMLElement>('.g-shade').forEach((el) => {
        el.style.opacity = (lift * 0.35).toFixed(3);
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

  /** Размытие движения по скорости (°/с). Только на всей сцене: внутри неё filter схлопнул бы 3D. */
  const smear = useCallback((speed: number) => {
    const el = scene.current;
    if (!el) return;
    const size = Math.min(1, Math.max(0.6, (card.current?.offsetWidth ?? 0) / 700));
    const want = calm() ? 0 : Math.min(4, Math.max(0, Math.abs(speed) - 80) / 150) * size;
    blur.current = speed === 0 ? 0 : blur.current + (want - blur.current) * 0.5;
    el.style.filter = blur.current > 0.15 ? `blur(${blur.current.toFixed(2)}px)` : '';
  }, []);

  const stop = () => {
    cancelAnimationFrame(frame.current);
    clearTimeout(still.current);
    frame.current = 0;
  };

  /** Доводит лист до угла: после броска — со скорости пальца, иначе — с разгоном и торможением. */
  const settle = useCallback(
    (target: number, velocity: number, done?: () => void) => {
      stop();
      const finish = () => {
        frame.current = 0;
        angle.current = target;
        apply(target);
        smear(0);
        done?.();
      };
      const from = angle.current;
      const path = target - from;
      const distance = Math.abs(path);
      if (calm() || distance < 0.1) return finish();
      const flung = velocity * Math.sign(path) > FLING;
      const duration = flung ? 380 + (distance / 180) * 320 : 420 + (distance / 180) * 480;
      // Степень торможения такая, чтобы в момент отпускания скорость равнялась скорости пальца.
      const power = Math.max(2, Math.min(8, (Math.abs(velocity) * duration) / 1000 / distance));
      const ease = flung ? (t: number) => 1 - (1 - t) ** power : turnEase;
      const t0 = performance.now();
      let last = t0;
      const tick = (now: number) => {
        // Метка кадра бывает раньше момента запуска.
        const t = Math.max(0, Math.min(1, (now - t0) / duration));
        const x = from + path * ease(t);
        if (now > last) smear(((x - angle.current) / (now - last)) * 1000);
        last = Math.max(last, now);
        angle.current = x;
        apply(x);
        if (t < 1) frame.current = requestAnimationFrame(tick);
        else finish();
      };
      frame.current = requestAnimationFrame(tick);
    },
    [apply, smear],
  );

  /** Повернуть лист к любому дню: оборот сразу показывает его. */
  const flipTo = useCallback(
    (i: number) => {
      const { index, days } = latest.current;
      if (frame.current || drag.current?.moved || i === index || !days[i]) return;
      latest.current.peer = i;
      setPeer(i);
      settle(i > index ? -180 : 180, 0, () => latest.current.onIndex(i));
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
    if ((e.target as Element).closest('button, a, dialog')) return;
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
      if (e.pointerType !== 'mouse' || frame.current || calm() || !tilt.current) return;
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
    const before = d.samples[d.samples.length - 1];
    if (e.timeStamp > before.t) smear(((a - angle.current) / (e.timeStamp - before.t)) * 1000);
    clearTimeout(still.current);
    still.current = window.setTimeout(() => smear(0), 80);
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
  const longest = Math.max(...visible.folderName.split(/[\s-]+/).map((w) => w.length));
  // Свет обоих дней готов заранее, по порядку дней: иначе React переставит слои и оборвёт переход.
  const lights = [...new Set([index, peer])].filter((i) => days[i]).sort((a, b) => a - b);

  return (
    <div
      className="g-stage"
      ref={rootRef}
      data-playing={playing || undefined}
      data-light={backdrop?.light || undefined}
      style={{ '--beat': beatSeconds(front.reveal.beats) + 's' } as CSSProperties}
    >
      <div className="g-space" aria-hidden="true">
        {lights.map((i) => (
          <div
            className="g-light"
            key={days[i].id}
            data-on={i === shown || undefined}
            style={{ '--glow': dayGlow(days[i]) } as CSSProperties}
          >
            <SceneBackdrop spec={days[i]} />
            <i className="g-glow" style={{ opacity: days[i].page.sheet?.scene.glowPower }} />
          </div>
        ))}
      </div>
      {backdrop?.stars !== false && (
        <Starfield
          color={glow}
          motion={motion}
          fall={fall}
          energy={visible.rhythm.density}
          light={!!backdrop?.light}
        />
      )}
      <div className="g-sparks" ref={sparks} hidden={backdrop?.sparks === false} aria-hidden="true">
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
          {backdrop?.orbits !== false && <Orbits />}
          <div className="g-idle" ref={idle}>
            <div className="g-tilt" ref={tilt}>
              <div className="g-lift">
                <div className="g-spin" ref={spin}>
                  <section className="g-face" aria-label={front.folderName}>
                    <div
                      className="g-page"
                      onScroll={(e) => {
                        // Лист прокручивается только вниз: случайный сдвиг вбок возвращаем.
                        if (e.currentTarget.scrollLeft) e.currentTarget.scrollLeft = 0;
                      }}
                    >
                      <FrontPage
                        key={front.id}
                        spec={front}
                        assemble={front.id === firstId}
                        slot={slot}
                        autoplay={autoplay}
                        onPlaying={onPlaying}
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
        <div className="g-top-actions">
          {own.has(visible.id) && (
            <>
              <a
                className="g-save"
                href={routeHref({ name: 'edit', id: visible.id })}
                aria-label="Изменить день"
                title="Изменить день"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M4 16l1-4 8-8 3 3-8 8-4 1zM11 6l3 3" />
                </svg>
              </a>
              <ExportButton key={visible.id} id={visible.id} />
            </>
          )}
          <WhyNote spec={visible} />
        </div>
      </header>

      <div className="g-side">
        <div className="g-copy" key={visible.id}>
          <p className="g-kicker">{formatDate(visible.date)}</p>
          <h1
            className="g-h1"
            data-long={visible.folderName.length > LONG_TITLE || undefined}
            data-very-long={visible.folderName.length > VERY_LONG_TITLE || undefined}
            style={{ '--longest': longest } as CSSProperties}
          >
            {words.map((w, i) => (
              <span className="g-word" key={i}>
                <span style={{ animationDelay: `${60 + i * 55}ms` }}>{w}</span>
              </span>
            ))}
          </h1>
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
              {photo && (
                <img src={photo.src} alt="" draggable={false} loading="lazy" decoding="async" />
              )}
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

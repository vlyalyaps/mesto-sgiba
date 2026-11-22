import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { demoDay } from '../app/days';
import { ExportButton } from '../app/ExportButton';
import { CutTitle } from '../render/CutTitle';
import { DaySpread } from '../render/DaySpread';
import { FlipThrough } from '../render/FlipThrough';
import { formatDate } from '../render/format';
import { moodLabel } from '../render/stickers/Sticker';
import { useAssembly } from '../render/useAssembly';
import type { DaySpec, Mood, MusicCarrier, WeatherSnapshot } from '../types/dayspec';
import { weatherFall, weatherWord } from '../weather/words';
import { Equalizer, Sparkle } from './glyphs';
import { beatSeconds, dayGlow } from './glow';
import { Starfield, type FieldMotion } from './Starfield';

/** Кривая iOS для приближения книги: быстрый старт и длинное мягкое торможение. */
const NEAR_EASE = 'cubic-bezier(.32,.72,0,1)';
/** Больше страниц за один перелист не листаем: дальние дни пролетают выборочно. */
const MAX_TURN = 6;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Передний день: живая страница, сборка по долям и звук. */
function FrontPage({
  spec,
  assemble,
  slot,
  flip,
  onPlaying,
}: {
  spec: DaySpec;
  assemble: boolean;
  slot: HTMLElement | null;
  flip?: ReactNode;
  onPlaying: (on: boolean) => void;
}) {
  const show = useAssembly(spec);
  // Пришли перелистыванием — страница уже собрана, как её было видно при перевороте.
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
      <DaySpread
        spec={spec}
        at={started ? show.at : Infinity}
        times={show.times}
        flip={flip}
        playback={
          song && (song.trackId || song.previewUrl)
            ? {
                toggle: () => {
                  setStarted(true);
                  void show.sound();
                },
                active: busy,
              }
            : undefined
        }
      />
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

/** Искры-ромбы вокруг книги в радостные дни: z — глубина, дальние мельче и размытее. */
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

function readings(spec: DaySpec) {
  let mood: Mood | undefined;
  let weather: WeatherSnapshot | undefined;
  let carrier: MusicCarrier | undefined;
  for (const e of spec.page.elements) {
    if (e.kind === 'mood') mood = e.mood;
    if (e.kind === 'weather') weather = e.weather;
    if (e.kind === 'ticket' && e.carrier) carrier = e.carrier;
  }
  return { mood, weather, carrier };
}

function weatherLine(w: WeatherSnapshot) {
  return `${weatherWord(w.code, w.hour)} · ${Math.round(w.tempC)}° · ${w.place}`;
}

/** Бумажные ярлыки дня: наклейка настроения, погода часа записи, этикетка песни. */
function facts(spec: DaySpec) {
  const { mood, weather } = readings(spec);
  return [
    mood && { kind: 'mood', text: moodLabel(mood) },
    weather && { kind: 'weather', text: weatherLine(weather) },
    spec.song && { kind: 'song', text: `♫ ${spec.song.title}` },
  ].filter((f): f is { kind: string; text: string } => !!f);
}

type Sky = 'sun' | 'cloud' | 'rain' | 'snow' | 'evening';

/**
 * Вид стола под каждый день — из того, что человек написал и какую песню выбрал.
 * Свет из окна — по погоде часа записи: солнце с тенью рамы, пасмурный ровный свет,
 * тени капель, снег или вечерняя лампа. Отсвет на столе — цвет снимков дня.
 * Лента под книгой — носитель песни её эпохи, искры — только в радостные дни.
 */
function look(spec: DaySpec) {
  const { mood, weather, carrier } = readings(spec);
  const fall = weather ? weatherFall(weather.code) : null;
  const evening = weather ? weather.hour >= 17 || weather.hour < 7 : false;
  const sky: Sky = fall ?? (evening ? 'evening' : weather && weather.code >= 2 ? 'cloud' : 'sun');
  return {
    carrier: carrier ?? (spec.song ? 'stream' : 'note'),
    fall,
    sky,
    mood: mood ?? 'calm',
    energy: spec.rhythm.density,
    sparks: mood === 'joyful' || mood === 'proud',
  };
}

/** «Почему так»: каждое решение страницы обычными словами, плюс источник погоды. */
function WhyNote({ spec, onClose }: { spec: DaySpec; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const weather = readings(spec).weather;
  const lines = spec.why.filter(
    (w) => w.param.startsWith('page.') || ['key', 'folderName', 'mode'].includes(w.param),
  );
  return (
    <dialog
      className="g-why"
      ref={dialog}
      aria-label="Почему так"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current.close();
      }}
    >
      <h2>Почему так</h2>
      <ul>
        {lines.map((w, i) => (
          <li key={i}>{w.text}</li>
        ))}
        {weather && (
          <li>
            Погода настоящая: {weather.place}, {weather.hour}:00 —{' '}
            {weatherWord(weather.code, weather.hour).toLowerCase()}, {Math.round(weather.tempC)}°.
            Данные{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>{' '}
            (CC BY 4.0) на час записи.
          </li>
        )}
      </ul>
      <button type="button" className="g-round g-why-close" onClick={() => dialog.current?.close()}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 5l10 10M15 5 5 15" />
        </svg>
        <span className="g-visually-hidden">Закрыть</span>
      </button>
    </dialog>
  );
}

/**
 * День — раскрытая книга на столе. Соседний день открывается настоящим переворотом страницы
 * (тот же StPageFlip, что листает тетрадь): свайп, стрелки, кнопки по краям или лента дней.
 * Касание книги приближает её во весь экран; листать можно и так.
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
  const motion = useRef<FieldMotion>({ pan: 0 });
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [why, setWhy] = useState(false);
  /** Книга приближена: во весь экран, без ленты и подписей. */
  const [near, setNear] = useState(false);
  const nearFrom = useRef<DOMRect | null>(null);
  const nearNow = useRef(near);
  nearNow.current = near;
  /** Куда листаем сейчас; пока страница переворачивается, новые перелисты ждут. */
  const [turn, setTurn] = useState<number | null>(null);
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const front = days[index];
  const day = look(front);

  const go = useCallback(
    (to: number) => {
      if (turn !== null || to === index || !days[to]) return;
      if (calm()) onIndex(to);
      else setTurn(to);
    },
    [turn, index, days, onIndex],
  );
  const goNow = useRef(go);
  goNow.current = go;

  // Страницы, которые пролетят при перевороте, по порядку дат. Вперёд книга останавливается
  // на последней, назад — на первой (так их ждёт FlipThrough).
  const pages = useMemo(() => {
    if (turn === null) return [];
    const [from, to] = turn > index ? [index + 1, turn] : [turn, index - 1];
    const all = days.slice(from, to + 1);
    if (all.length <= MAX_TURN) return all;
    return Array.from(
      { length: MAX_TURN },
      (_, k) => all[Math.round(((all.length - 1) * k) / (MAX_TURN - 1))],
    );
  }, [turn, index, days]);
  const landed = useCallback(() => {
    if (turn === null) return;
    onIndex(turn);
    setTurn(null);
  }, [turn, onIndex]);
  const flip =
    turn !== null && pages.length ? (
      <FlipThrough entries={pages} back={turn < index} done={landed} />
    ) : undefined;

  useLayoutEffect(() => {
    const root = rootRef.current;
    root?.style.setProperty('--glow', dayGlow(front));
    root?.style.setProperty('--shade', front.duo[0]);
  }, [front, rootRef]);

  /** Приблизить или отдалить книгу: запоминаем, где она была, и доводим её оттуда (FLIP). */
  const setCloser = useCallback((on: boolean) => {
    if (on === nearNow.current) return;
    if (card.current) nearFrom.current = card.current.getBoundingClientRect();
    setNear(on);
  }, []);

  useLayoutEffect(() => {
    const from = nearFrom.current;
    nearFrom.current = null;
    const el = card.current;
    if (!from || !el || calm()) return;
    const to = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` },
        { transform: 'none' },
      ],
      { duration: near ? 620 : 520, easing: NEAR_EASE },
    );
  }, [near]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') goNow.current(index - 1);
      else if (e.key === 'ArrowRight') goNow.current(index + 1);
      else if (e.key === 'Escape') {
        if (nearNow.current) setCloser(false);
        else onClose();
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [index, onClose, setCloser]);

  // Активный день на ленте всегда в поле зрения. Крутим только саму ленту.
  useEffect(() => {
    const rail = rootRef.current?.querySelector<HTMLElement>('.g-rail');
    const item = rail?.querySelector<HTMLElement>(`[data-i="${index}"]`);
    if (!rail || !item) return;
    rail.scrollTo({
      left: item.offsetLeft - rail.clientWidth / 2 + item.offsetWidth / 2,
      top: item.offsetTop - rail.clientHeight / 2 + item.offsetHeight / 2,
      behavior: calm() ? 'auto' : 'smooth',
    });
  }, [index, rootRef]);

  function down(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }

  function up(e: ReactPointerEvent) {
    const p = press.current;
    press.current = null;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const target = e.target as Element;
    if (Math.abs(dx) > 56 && Math.abs(dy) < Math.abs(dx) * 0.6) {
      // Свайп листает; отпущенный палец не должен нажать на фото под ним.
      const swallow = (c: Event) => c.stopPropagation();
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
      go(index + (dx < 0 ? 1 : -1));
      return;
    }
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8 || target.closest('button, a')) return;
    if (target.closest('.g-card')) setCloser(true);
    else if (near) setCloser(false);
  }

  const onPlaying = useCallback((on: boolean) => setPlaying(on), []);
  const ticker = [front.folderName, ...facts(front).map((f) => f.text), formatDate(front.date)];

  return (
    <div
      className="g-stage"
      ref={rootRef}
      data-playing={playing || undefined}
      data-near={near || undefined}
      data-turning={turn !== null || undefined}
      data-carrier={day.carrier}
      data-sky={day.sky}
      data-mood={day.mood}
      style={
        {
          '--beat': beatSeconds(front.reveal.beats) + 's',
          '--energy': day.energy.toFixed(2),
        } as CSSProperties
      }
    >
      <div className="g-space" aria-hidden="true">
        <i className="g-window" />
        <i className="g-glow" />
        <i className="g-frame" />
      </div>
      <Starfield color={dayGlow(front)} motion={motion} fall={day.fall} energy={day.energy} light />
      <div className="g-ribbon" aria-hidden="true">
        <div className="g-ribbon-track" key={front.id}>
          {[0, 1].map((k) => (
            <span key={k}>
              {[...ticker, ...ticker].map((t, i) => (
                <b key={i}>{t}</b>
              ))}
            </span>
          ))}
        </div>
      </div>
      <div className="g-sparks" aria-hidden="true">
        {(day.sparks ? SPARKS : []).map((s, i) => (
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
        onPointerUp={up}
        onPointerCancel={() => {
          press.current = null;
        }}
      >
        <div className="g-card" ref={card}>
          <div className="g-lift">
            <section className="g-face" aria-label={front.folderName}>
              <div
                className="g-page"
                onScroll={(e) => {
                  // Книга листается только вертикально: случайный сдвиг вбок сразу возвращаем.
                  if (e.currentTarget.scrollLeft) e.currentTarget.scrollLeft = 0;
                }}
              >
                <FrontPage
                  key={front.id}
                  spec={front}
                  assemble={front.id === firstId}
                  slot={slot}
                  flip={flip}
                  onPlaying={onPlaying}
                />
              </div>
            </section>
          </div>
        </div>
        <button
          type="button"
          className="g-turn g-turn-prev"
          onClick={() => go(index - 1)}
          disabled={!days[index - 1]}
          aria-label="Предыдущий день"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4 6.5 10l6 6" />
          </svg>
        </button>
        <button
          type="button"
          className="g-turn g-turn-next"
          onClick={() => go(index + 1)}
          disabled={!days[index + 1]}
          aria-label="Следующий день"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m7.5 4 6 6-6 6" />
          </svg>
        </button>
      </div>

      <header className="g-top">
        <button type="button" className="g-round" onClick={onClose} aria-label="Ко всем дням">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4 6.5 10l6 6" />
          </svg>
        </button>
        <p className="g-counter" aria-live="polite">
          <b>{String(index + 1).padStart(2, '0')}</b>
          <i style={{ '--p': (index + 1) / days.length } as CSSProperties} />
          <span>{String(days.length).padStart(2, '0')}</span>
        </p>
        <button
          type="button"
          className="g-round g-closer"
          onClick={() => setCloser(!near)}
          aria-label={near ? 'Отдалить страницу' : 'Рассмотреть страницу ближе'}
          aria-pressed={near}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            {near ? (
              <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" />
            ) : (
              <path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" />
            )}
          </svg>
        </button>
      </header>

      <div className="g-side">
        <div className="g-copy" key={front.id}>
          <p className="g-kicker">
            {formatDate(front.date)} {front.date.slice(0, 4)}
            <span> · лист {String(front.number).padStart(3, '0')}</span>
          </p>
          <h1 className="g-h1">
            <CutTitle
              title={front.folderName}
              sets={front.page.titleAlphabets ?? ['news']}
              id={front.id}
            />
          </h1>
          <ul className="g-facts">
            {facts(front).map((f, i) => (
              <li key={f.kind} data-kind={f.kind} style={{ animationDelay: `${420 + i * 70}ms` }}>
                {f.text}
              </li>
            ))}
          </ul>
          <div className="g-extra">
            <button type="button" className="g-link" onClick={() => setWhy(true)}>
              Почему так
            </button>
            {!demoDay(front.id) && <ExportButton id={front.id} className="g-link" />}
          </div>
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
              aria-current={i === index || undefined}
              aria-label={`${formatDate(d.date)}: ${d.folderName}`}
              onClick={() => go(i)}
              style={{ '--tint': dayGlow(d) } as CSSProperties}
            >
              {photo && <img src={photo.src} alt="" draggable={false} />}
              <span>{d.date.slice(8)}</span>
            </button>
          );
        })}
      </nav>
      {why && <WhyNote spec={front} onClose={() => setWhy(false)} />}
    </div>
  );
}

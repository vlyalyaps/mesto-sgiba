import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { ImportButton } from '../app/ImportButton';
import { warmPreview } from '../audio/itunes';
import { MonthCover } from '../app/MonthCover';
import { monthTitle, useArchive } from '../app/months';
import { routeHref } from '../app/router';
import { buildCalendar, localToday } from './calendar';
import { DayGrid } from './DayGrid';
import { DayStage } from './DayStage';
import { Mark } from './glyphs';
import './gallery.css';

type Phase = 'grid' | 'opening' | 'open' | 'closing';
/** Кривая и длительности как у раскрытия карточек в iOS: быстрый старт, долгое мягкое торможение. */
const EASE = 'cubic-bezier(.32,.72,0,1)';
const DURATION = 680;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Камера ныряет в день: сетка растёт вокруг квадратика и тает, из квадратика расходится свет дня,
 * а сам квадратик раскрывается в лист — сначала верхний квадрат с фото, потом весь лист вниз.
 * Подписи и лента дней появляются следом, по очереди. Назад — тот же путь в обратную сторону.
 */
function zoom(grid: HTMLElement, stage: HTMLElement, cell: HTMLElement | null, inward: boolean) {
  const lift = stage.querySelector<HTMLElement>('.g-card .g-lift');
  const options = { duration: inward ? DURATION : 520, easing: EASE, fill: 'both' as const };
  const flip = (frames: Keyframe[]) => (inward ? frames : [...frames].reverse());
  const anims: Animation[] = [];
  const chrome = stage.querySelectorAll<HTMLElement>(
    '.g-top, .g-side, .g-rail, .g-turn, .g-ribbon, .g-sparks',
  );
  chrome.forEach((el, i) =>
    anims.push(
      el.animate(
        flip([
          { opacity: 0, translate: '0 14px' },
          { opacity: 1, translate: '0 0' },
        ]),
        { ...options, delay: inward ? 220 + i * 40 : 0, duration: inward ? 600 : 240 },
      ),
    ),
  );
  const a = cell?.getBoundingClientRect();
  const origin = a ? `${a.left + a.width / 2}px ${a.top + a.height / 2}px` : '50% 50%';
  for (const el of stage.querySelectorAll<HTMLElement>('.g-space, .g-stars'))
    anims.push(
      el.animate(
        flip([
          { clipPath: `circle(0% at ${origin})`, opacity: 0.6 },
          { clipPath: `circle(150% at ${origin})`, opacity: 1 },
        ]),
        options,
      ),
    );
  if (!a || !lift) {
    anims.push(grid.animate(flip([{ opacity: 1 }, { opacity: 0 }]), options));
    return anims;
  }
  const b = lift.getBoundingClientRect();
  const s = a.width / b.width;
  const dx = a.left + a.width / 2 - (b.left + b.width / 2);
  const dy = a.top + a.height / 2 - (b.top + b.width / 2);
  const hidden = Math.max(0, ((b.height - b.width) / b.height) * 100);
  const originY = '50% ' + (b.width / 2 / b.height) * 100 + '%';
  anims.push(
    lift.animate(
      flip([
        {
          transform: `translate(${dx}px, ${dy}px) scale(${s})`,
          clipPath: `inset(0 0 ${hidden}% 0 round 14px)`,
          transformOrigin: originY,
          opacity: 0.5,
        },
        { opacity: 1, offset: 0.18 },
        {
          transform: 'none',
          clipPath: 'inset(0 0 0% 0 round 6px)',
          transformOrigin: originY,
          opacity: 1,
        },
      ]),
      options,
    ),
  );
  grid.style.transformOrigin = origin;
  anims.push(
    grid.animate(
      flip([
        { transform: 'none', opacity: 1, filter: 'blur(0px)' },
        { transform: 'scale(1.6)', opacity: 0, filter: 'blur(6px)' },
      ]),
      options,
    ),
  );
  return anims;
}

/**
 * Главный экран — письменный стол вечером: сверху тетради месяцев, ниже чёрный фотоальбом,
 * где каждый день — отпечаток с подписью гелевой ручкой. Касание раскрывает день на том же столе.
 */
export function GalleryScreen({ id: dayId, month }: { id?: string; month?: string }) {
  // Нового дня ещё нет в списке — перечитываем архив по его адресу.
  const [wanted, setWanted] = useState<string | undefined>();
  const { entries, ready } = useArchive(wanted);
  const days = useMemo(
    () =>
      entries
        .map((e) => e.spec)
        .sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number),
    [entries],
  );
  // Тетрадь открывается на первом дне своего месяца.
  const id = dayId ?? (month ? days.find((d) => d.date.startsWith(month))?.id : undefined);
  const missing = !!dayId && !days.some((d) => d.id === dayId);
  useEffect(() => {
    if (missing) setWanted(dayId);
  }, [missing, dayId]);
  const today = useMemo(() => localToday(), []);
  // Свежий месяц сверху, дни внутри месяца — по порядку, как в календаре.
  const blocks = useMemo(() => buildCalendar(days, today).reverse(), [days, today]);
  const months = useMemo(
    () => [...new Set(days.map((d) => d.date.slice(0, 7)))].sort().reverse(),
    [days],
  );
  const grid = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [front, setFront] = useState<string | null>(id ?? null);
  const [first, setFirst] = useState<string | null>(id ?? null);
  const [phase, setPhase] = useState<Phase>(id ? 'open' : 'grid');
  const fromGrid = useRef(false);
  const phaseNow = useRef(phase);
  phaseNow.current = phase;

  // Адрес → состояние: '#/gallery/<id>' раскрывает день, '#/gallery' возвращает к сетке.
  useEffect(() => {
    const p = phaseNow.current;
    if (id) {
      setFront(id);
      if (p === 'grid' || p === 'closing') {
        setFirst(id);
        setPhase(calm() ? 'open' : 'opening');
      }
    } else if (p === 'open' || p === 'opening') setPhase(calm() ? 'grid' : 'closing');
  }, [id]);

  useLayoutEffect(() => {
    if (phase !== 'opening' && phase !== 'closing') return;
    const g = grid.current;
    const s = stage.current;
    if (!g || !s || !front) {
      setPhase(phase === 'opening' ? 'open' : 'grid');
      return;
    }
    const cell = g.querySelector<HTMLElement>(`[data-day="${front}"]`);
    if (phase === 'closing') cell?.scrollIntoView({ block: 'center' });
    const anims = zoom(g, s, cell, phase === 'opening');
    let live = true;
    void Promise.all(anims.map((a) => a.finished))
      .then(() => {
        if (live) setPhase(phase === 'opening' ? 'open' : 'grid');
      })
      .catch(() => undefined);
    return () => {
      live = false;
      anims.forEach((a) => a.cancel());
    };
  }, [phase, front]);

  useEffect(() => {
    if (phase === 'grid') {
      setFront(null);
      fromGrid.current = false;
    }
  }, [phase]);

  const index = front ? days.findIndex((d) => d.id === front) : -1;

  const onIndex = useCallback(
    (i: number) => {
      const next = days[i];
      if (!next) return;
      setFront(next.id);
      // Листание не копит историю: «назад» сразу возвращает к сетке.
      history.replaceState(history.state, '', '#/gallery/' + next.id);
    },
    [days],
  );

  const close = useCallback(() => {
    if (fromGrid.current) history.back();
    else location.hash = '#/';
  }, []);

  return (
    <main className="gallery" data-phase={phase}>
      <div className="g-grid" ref={grid} inert={phase === 'open'}>
        <header className="g-bar">
          <p className="g-brand">
            <Mark />
            Место сгиба
          </p>
          <a className="g-new" href="#/new">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 4v12M4 10h12" />
            </svg>
            <span>Записать день</span>
          </a>
        </header>
        <h1 className="g-visually-hidden">Место сгиба: тетради и дни</h1>
        <i className="g-leaves" aria-hidden="true" />
        <div className="g-still" aria-hidden="true">
          <img
            className="g-still-ring"
            src={`${import.meta.env.BASE_URL}scraps/047/tea-ring.webp`}
            alt=""
          />
          <p className="g-still-note">сегодня — записать день ♡</p>
          <img
            className="g-still-flower"
            src={`${import.meta.env.BASE_URL}scraps/life/dried-flower.webp`}
            alt=""
          />
          <img
            className="g-still-clip"
            src={`${import.meta.env.BASE_URL}scraps/life/worn-clip.webp`}
            alt=""
          />
        </div>
        {months.length > 0 && (
          <section className="g-shelf" aria-labelledby="g-books-label">
            <h2 className="g-label" id="g-books-label">
              Тетради
            </h2>
            <ol className="g-books">
              {months.map((month, i) => (
                <li
                  key={month}
                  style={{ '--r': `${[-2.2, 1.6, -0.8, 2.4][i % 4]}deg` } as CSSProperties}
                >
                  <a
                    href={routeHref({ name: 'month', month, contents: false })}
                    aria-label={`Открыть книгу: ${monthTitle(month)} ${month.slice(0, 4)}`}
                    onPointerDown={() =>
                      warmPreview(days.find((d) => d.date.startsWith(month))?.song?.trackId)
                    }
                  >
                    <MonthCover
                      month={month}
                      entries={entries.filter((e) => e.spec.date.startsWith(month))}
                    />
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}
        <h2 className="g-label g-label-days">Все дни</h2>
        <DayGrid
          blocks={blocks}
          today={today}
          scroller={grid}
          onOpen={() => {
            fromGrid.current = true;
          }}
        />
        <footer className="g-foot">
          <ImportButton className="g-quiet" />
        </footer>
      </div>
      {phase !== 'grid' && index >= 0 && (
        <DayStage
          days={days}
          index={index}
          firstId={first ?? days[index].id}
          rootRef={stage}
          onIndex={onIndex}
          onClose={close}
        />
      )}
      {phase !== 'grid' && front && index < 0 && ready && wanted === dayId && (
        <div className="g-stage g-missing">
          <p>Такого дня нет.</p>
          <a className="g-pill-link" href="#/">
            Ко всем дням
          </a>
        </div>
      )}
    </main>
  );
}

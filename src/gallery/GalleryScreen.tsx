import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEntries } from '../app/months';
import { buildCalendar, localToday } from './calendar';
import { DayGrid } from './DayGrid';
import { DayStage } from './DayStage';
import { Mark } from './glyphs';
import './gallery.css';

type Phase = 'grid' | 'opening' | 'open' | 'closing';
const EASE = 'cubic-bezier(.22,1,.36,1)';
const DURATION = 720;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Камера ныряет в день: сетка растёт вокруг квадратика и тает, из квадратика расходится свет дня,
 * а сам квадратик раскрывается в лист — сначала верхний квадрат с фото, потом весь лист вниз.
 * Подписи и лента дней появляются следом, по очереди. Назад — тот же путь в обратную сторону.
 */
function zoom(grid: HTMLElement, stage: HTMLElement, cell: HTMLElement | null, inward: boolean) {
  const lift = stage.querySelector<HTMLElement>('.g-card .g-lift');
  const options = { duration: inward ? DURATION : 560, easing: EASE, fill: 'both' as const };
  const flip = (frames: Keyframe[]) => (inward ? frames : [...frames].reverse());
  const anims: Animation[] = [];
  const chrome = stage.querySelectorAll<HTMLElement>(
    '.g-top, .g-side, .g-rail, .g-hint, .g-marquee, .g-sparks, .g-orbits',
  );
  chrome.forEach((el, i) =>
    anims.push(
      el.animate(
        flip([
          { opacity: 0, translate: '0 14px' },
          { opacity: 1, translate: '0 0' },
        ]),
        { ...options, delay: inward ? 200 + i * 45 : 0, duration: inward ? 560 : 260 },
      ),
    ),
  );
  const a = cell?.getBoundingClientRect();
  const origin = a ? `${a.left + a.width / 2}px ${a.top + a.height / 2}px` : '50% 50%';
  for (const el of stage.querySelectorAll<HTMLElement>('.g-space, .g-stars'))
    anims.push(
      el.animate(
        flip([
          { clipPath: `circle(0% at ${origin})`, opacity: 0.4 },
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
        { transform: 'none', opacity: 1 },
        { transform: 'scale(2.4)', opacity: 0 },
      ]),
      options,
    ),
  );
  return anims;
}

/** Прототип: все дни сеткой, касание — зум внутрь дня, день — лист в тёмном пространстве. */
export function GalleryScreen({ id }: { id?: string }) {
  const entries = useEntries();
  const days = useMemo(
    () =>
      entries
        .map((e) => e.spec)
        .sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number),
    [entries],
  );
  const today = useMemo(() => localToday(), []);
  const blocks = useMemo(() => buildCalendar(days, today), [days, today]);
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

  // Первый показ сетки — к самым свежим дням внизу.
  useLayoutEffect(() => {
    if (grid.current) grid.current.scrollTop = grid.current.scrollHeight;
  }, []);

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
    else location.hash = '#/gallery';
  }, []);

  return (
    <main className="gallery" data-phase={phase}>
      <div className="g-grid" ref={grid} inert={phase === 'open'}>
        <header className="g-bar">
          <a className="g-round" href="#/" aria-label="К книжной полке">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M12.5 4 6.5 10l6 6" />
            </svg>
          </a>
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
        <div className="g-hero">
          <h1>Дни</h1>
          <p>Каждый квадрат — день. Щипком — крупнее или мельче, касанием — внутрь дня.</p>
        </div>
        <DayGrid
          blocks={blocks}
          today={today}
          scroller={grid}
          onOpen={() => {
            fromGrid.current = true;
          }}
        />
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
      {phase !== 'grid' && front && index < 0 && (
        <div className="g-stage g-missing">
          <p>Такого дня нет.</p>
          <a className="g-pill-link" href="#/gallery">
            Ко всем дням
          </a>
        </div>
      )}
    </main>
  );
}

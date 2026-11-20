import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEntries } from '../app/months';
import { buildCalendar, localToday } from './calendar';
import { DayGrid } from './DayGrid';
import { DayStage } from './DayStage';
import './gallery.css';

type Phase = 'grid' | 'opening' | 'open' | 'closing';
const EASE = 'cubic-bezier(.22,1,.36,1)';
const DURATION = 640;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Камера ныряет в день: сетка растёт вокруг квадратика и тает, а квадратик раскрывается в лист.
 * Лист сначала обрезан до верхнего квадрата (там фото, как на миниатюре) и разворачивается вниз.
 */
function zoom(grid: HTMLElement, stage: HTMLElement, cell: HTMLElement | null, inward: boolean) {
  const lift = stage.querySelector<HTMLElement>('.g-card[data-front] .g-lift');
  const options = { duration: DURATION, easing: EASE, fill: 'both' as const };
  const flip = (frames: Keyframe[]) => (inward ? frames : [...frames].reverse());
  const anims: Animation[] = [];
  for (const el of stage.querySelectorAll<HTMLElement>(
    '.g-sky, .g-depth, .g-stage-bar, .g-count, .g-sound-slot, .g-arrow',
  ))
    anims.push(el.animate(flip([{ opacity: 0 }, { opacity: 1 }]), options));
  for (const el of stage.querySelectorAll<HTMLElement>('.g-card:not([data-front])'))
    anims.push(
      el.animate(flip([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }]), options),
    );
  if (!cell || !lift) {
    anims.push(grid.animate(flip([{ opacity: 1 }, { opacity: 0 }]), options));
    return anims;
  }
  const a = cell.getBoundingClientRect();
  const b = lift.getBoundingClientRect();
  const s = a.width / b.width;
  const dx = a.left + a.width / 2 - (b.left + b.width / 2);
  const dy = a.top + a.height / 2 - (b.top + b.width / 2);
  const hidden = Math.max(0, ((b.height - b.width) / b.height) * 100);
  anims.push(
    lift.animate(
      flip([
        {
          transform: `translate(${dx}px, ${dy}px) scale(${s})`,
          clipPath: `inset(0 0 ${hidden}% 0 round 12px)`,
          transformOrigin: '50% ' + (b.width / 2 / b.height) * 100 + '%',
          opacity: 0.6,
        },
        { opacity: 1, offset: 0.2 },
        {
          transform: 'none',
          clipPath: 'inset(0 0 0% 0 round 6px)',
          transformOrigin: '50% ' + (b.width / 2 / b.height) * 100 + '%',
          opacity: 1,
        },
      ]),
      options,
    ),
  );
  grid.style.transformOrigin = `${a.left + a.width / 2}px ${a.top + a.height / 2}px`;
  anims.push(
    grid.animate(
      flip([
        { transform: 'none', opacity: 1 },
        { transform: 'scale(2.6)', opacity: 0 },
      ]),
      options,
    ),
  );
  return anims;
}

/** Прототип: все дни сеткой, касание — зум внутрь дня, день — лист в пространстве на кольце. */
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
          <a className="g-home" href="#/" aria-label="К книжной полке">
            ←
          </a>
          <div>
            <h1>Дни</h1>
            <p>Щипком — крупнее или мельче</p>
          </div>
          <a className="ink-button" href="#/new">
            <span aria-hidden="true">＋</span> Записать
          </a>
        </header>
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
          <a className="g-chip" href="#/gallery">
            ← Дни
          </a>
        </div>
      )}
    </main>
  );
}

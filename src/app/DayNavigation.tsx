import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlipThrough } from '../render/FlipThrough';
import { monthTitle, useEntries } from './months';
import { landOnDay, routeHref } from './router';
export function DayNavigation({
  id,
  children,
}: {
  id: string;
  children: (flip?: ReactNode) => ReactNode;
}) {
  const all = useEntries();
  const month = id.slice(0, 7);
  const days = useMemo(
    () =>
      all
        .filter((e) => e.spec.date.startsWith(month))
        .map((e) => e.spec)
        .reverse(),
    [all, month],
  );
  const at = days.findIndex((d) => d.id === id);
  const [turn, setTurn] = useState<number | null>(null);
  const go = useCallback(
    (index: number) => {
      const next = days[index];
      if (!next || index === at || turn !== null) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches)
        location.hash = routeHref({ name: 'day', id: next.id });
      else setTurn(index);
    },
    [at, days, turn],
  );
  const targets = useMemo(() => (turn !== null && days[turn] ? [days[turn]] : []), [turn, days]);
  const done = useCallback(() => {
    if (turn !== null && days[turn]) landOnDay(days[turn].id);
  }, [days, turn]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        document.querySelector('dialog[open]') ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.target instanceof HTMLInputElement
      )
        return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        go(at + (e.key === 'ArrowLeft' ? -1 : 1));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [at, go]);
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      onTouchStart={(e) => {
        if (e.touches.length === 1 && !document.querySelector('dialog[open]'))
          start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchCancel={() => {
        start.current = null;
      }}
      onTouchEnd={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const dx = e.changedTouches[0].clientX - s.x,
          dy = e.changedTouches[0].clientY - s.y;
        if (Math.abs(dx) > 65 && Math.abs(dy) < Math.abs(dx) * 0.45) go(at + (dx < 0 ? 1 : -1));
      }}
    >
      <nav className="desk-nav">
        <a href={routeHref({ name: 'month', month, contents: true })}>← Оглавление</a>
        <span>
          {monthTitle(month)} {month.slice(0, 4)}
        </span>
        <div className="day-arrows">
          <button onClick={() => go(at - 1)} disabled={at <= 0} aria-label="Предыдущий день">
            ←
          </button>
          <button
            onClick={() => go(at + 1)}
            disabled={at < 0 || at >= days.length - 1}
            aria-label="Следующий день"
          >
            →
          </button>
        </div>
      </nav>
      {children(
        turn !== null && targets.length > 0 ? (
          <FlipThrough entries={targets} back={turn < at} done={done} />
        ) : undefined,
      )}
    </div>
  );
}

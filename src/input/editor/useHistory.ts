import { useCallback, useMemo, useRef, useState } from 'react';

const LIMIT = 120;
const PAUSE_MS = 900;

export interface History<T> {
  now: T;
  canUndo: boolean;
  canRedo: boolean;
  /** Одинаковый tag подряд — один шаг: жест целиком, ползунок, набор текста. */
  change(next: (now: T) => T, tag?: string): void;
  undo(): void;
  redo(): void;
}

export function useHistory<T>(initial: T): History<T> {
  const [state, setState] = useState(() => ({
    past: [] as T[],
    now: initial,
    future: [] as T[],
  }));
  const last = useRef({ tag: '', time: 0 });

  const change = useCallback((next: (now: T) => T, tag = '') => {
    const time = Date.now();
    const same =
      !!tag &&
      tag === last.current.tag &&
      (tag.startsWith('gesture') || time - last.current.time < PAUSE_MS);
    last.current = { tag, time };
    setState((s) => {
      const now = next(s.now);
      if (now === s.now) return s;
      const past = same && s.past.length ? s.past : [...s.past.slice(1 - LIMIT), s.now];
      return { past, now, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    last.current.tag = '';
    setState((s) =>
      s.past.length
        ? {
            past: s.past.slice(0, -1),
            now: s.past[s.past.length - 1],
            future: [s.now, ...s.future],
          }
        : s,
    );
  }, []);

  const redo = useCallback(() => {
    last.current.tag = '';
    setState((s) =>
      s.future.length
        ? { past: [...s.past, s.now], now: s.future[0], future: s.future.slice(1) }
        : s,
    );
  }, []);

  return useMemo(
    () => ({
      now: state.now,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      change,
      undo,
      redo,
    }),
    [state, change, undo, redo],
  );
}

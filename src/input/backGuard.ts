import { useEffect, useRef } from 'react';

const marked = () => !!(window.history.state as { draft?: boolean } | null)?.draft;
const mark = () => window.history.pushState({ draft: true }, '');

/**
 * Пока в записи что-то есть, у экрана своя отметка в истории: системная «назад»
 * снимает её и спрашивает, а не уводит вместе с черновиком.
 *
 * onBack возвращает true, если «назад» закрыла окно поверх листа и отметку надо вернуть.
 */
export function useBackGuard(dirty: boolean, paused: boolean, onBack: () => boolean) {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  useEffect(() => {
    if (!dirty) return;
    if (!paused && !marked()) mark();
    const here = window.location.hash;
    const back = () => {
      if (window.location.hash !== here || marked()) return;
      if (latest.current()) mark();
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [dirty, paused]);
}

/** Перед уходом с записи снимаем отметку, чтобы «назад» потом не открывала пустую запись. */
export function releaseDraft(): Promise<void> {
  if (!marked()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', done);
      resolve();
    };
    const timer = setTimeout(done, 500);
    window.addEventListener('popstate', done);
    window.history.back();
  });
}

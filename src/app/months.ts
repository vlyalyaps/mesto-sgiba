import { useCallback, useEffect, useState } from 'react';
import { demoArchive, loadArchive } from './days';

/** ready — архив дочитан: до этого своего дня ещё может не быть среди entries. */
export function useEntries() {
  const [state, setState] = useState(() => ({ entries: demoArchive(), ready: false }));
  useEffect(() => {
    let live = true;
    loadArchive()
      .catch((e) => {
        console.warn('Архив не открылся, показываем демо-дни:', e);
        return demoArchive();
      })
      .then((entries) => {
        // Второй ответ подменил бы открытый день и оборвал его песню.
        if (live) setState({ entries, ready: true });
      });
    return () => {
      live = false;
    };
  }, []);
  const reload = useCallback(async () => {
    setState({ entries: await loadArchive(), ready: true });
  }, []);
  return { ...state, reload };
}
export function monthTitle(month: string) {
  const [year, m] = month.split('-').map(Number);
  const label = new Date(year, m - 1, 1).toLocaleDateString('ru', { month: 'long' });
  return label[0].toUpperCase() + label.slice(1);
}
export function entryCount(n: number) {
  return (
    n +
    ' ' +
    (n % 10 === 1 && n % 100 !== 11
      ? 'запись'
      : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? 'записи'
        : 'записей')
  );
}

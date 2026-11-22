import { useEffect, useState } from 'react';
import { demoArchive, loadArchive } from './days';
/**
 * Все дни: демо сразу, свои — из архива. `refresh` перечитывает архив, когда меняется:
 * так стол видит день, который только что записали или добавили из ZIP.
 */
export function useArchive(refresh?: string) {
  const [state, setState] = useState(() => ({ entries: demoArchive(), ready: false }));
  const [asked, setAsked] = useState(refresh);
  // Пока архив перечитывается по новому адресу, «готово» не говорим.
  if (asked !== refresh) {
    setAsked(refresh);
    setState((s) => ({ ...s, ready: false }));
  }
  useEffect(() => {
    let live = true;
    void loadArchive().then((all) => {
      if (live) setState({ entries: all, ready: true });
    });
    return () => {
      live = false;
    };
  }, [refresh]);
  return state;
}

export function useEntries() {
  return useArchive().entries;
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

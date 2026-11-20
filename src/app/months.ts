import { useEffect, useState } from 'react';
import { demoArchive, loadArchive } from './days';
export function useEntries() {
  const [entries, setEntries] = useState(demoArchive);
  useEffect(() => {
    let live = true;
    void loadArchive().then((all) => {
      if (live) setEntries(all);
    });
    return () => {
      live = false;
    };
  }, []);
  return entries;
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

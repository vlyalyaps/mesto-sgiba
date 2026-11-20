import { useEffect, useState } from 'react';
import { SketchbookDay } from '../render/SketchbookDay';
import type { DaySpec } from '../types/dayspec';
import { Skeleton } from '../ui/Skeleton';
import { demoDay, loadDay } from './days';
import { DayNavigation } from './DayNavigation';

export function DayScreen({ id }: { id: string }) {
  // undefined — ещё грузим, null — такого дня нет.
  const [spec, setSpec] = useState<DaySpec | null | undefined>(() => demoDay(id) ?? undefined);

  useEffect(() => {
    let live = true;
    void loadDay(id).then((s) => {
      if (live) setSpec(s);
    });
    return () => {
      live = false;
    };
  }, [id]);

  return (
    <main className="day" aria-busy={spec === undefined}>
      <DayNavigation id={id}>
        {spec === undefined && <Skeleton className="book-skeleton" />}
        {spec === null && <p className="placeholder">Такого дня в архиве нет.</p>}
        {spec && <SketchbookDay spec={spec} />}
      </DayNavigation>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { exportDay } from '../archive/zip';
import { SketchbookDay } from '../render/SketchbookDay';
import type { DaySpec } from '../types/dayspec';
import { Skeleton } from '../ui/Skeleton';
import { demoDay, loadDay } from './days';
import { DayNavigation } from './DayNavigation';

function ExportButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const url = URL.createObjectURL(await exportDay(id));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${id}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось собрать архив.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ margin: '0 auto 24px', padding: '0 16px', textAlign: 'center' }}>
      <button className="ink-button" onClick={() => void run()} disabled={busy} aria-busy={busy}>
        {busy ? 'Собираю папку…' : 'Скачать папку дня (ZIP)'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function DayScreen({ id, assembled = false }: { id: string; assembled?: boolean }) {
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
        {(flip) => (
          <>
            {spec === undefined && <Skeleton className="book-skeleton" />}
            {spec === null && <p className="placeholder">Такого дня в архиве нет.</p>}
            {spec && <SketchbookDay spec={spec} flip={flip} assembled={assembled} />}
            {spec && !demoDay(id) && <ExportButton id={id} />}
          </>
        )}
      </DayNavigation>
    </main>
  );
}

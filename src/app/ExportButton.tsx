import { useState } from 'react';
import { exportDay } from '../archive/zip';

/** «Скачать папку дня (ZIP)»: текст, фото, данные песни и разметка страницы с её объяснением. */
export function ExportButton({ id, className = 'ink-button' }: { id: string; className?: string }) {
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
    <>
      <button className={className} onClick={() => void run()} disabled={busy} aria-busy={busy}>
        {busy ? 'Собираю папку…' : 'Скачать папку дня (ZIP)'}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

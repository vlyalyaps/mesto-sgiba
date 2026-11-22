import { useState } from 'react';
import { exportDay } from '../archive/zip';

/** «Скачать папку дня (ZIP)»: значок рядом с вопросиком, только у своих дней. */
export function ExportButton({ id }: { id: string }) {
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
      <button
        type="button"
        className="g-save"
        onClick={() => void run()}
        disabled={busy}
        aria-busy={busy}
        aria-label="Скачать папку дня (ZIP)"
        title="Скачать папку дня (ZIP)"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M4 16h12" />
        </svg>
      </button>
      {error && (
        <p className="g-save-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

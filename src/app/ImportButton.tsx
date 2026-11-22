import { useRef, useState } from 'react';
import { importZip } from '../archive/zip';

/** «Добавить из ZIP»: день из скачанной папки возвращается к остальным дням. */
export function ImportButton({
  className,
  onDone,
}: {
  className: string;
  onDone: (id: string) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await onDone(await importZip(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить день из архива.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div>
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <button
        type="button"
        className={className}
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? 'Читаю архив…' : 'Добавить из ZIP'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

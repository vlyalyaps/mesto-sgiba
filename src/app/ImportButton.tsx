import { useRef, useState } from 'react';
import { importZip } from '../archive/zip';
import { routeHref } from './router';
/** «Добавить из ZIP»: день из скачанной папки возвращается на стол. */
export function ImportButton({ className = 'ink-button' }: { className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const id = await importZip(file);
      window.location.hash = routeHref({ name: 'day', id });
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

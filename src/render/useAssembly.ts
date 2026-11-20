import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPlayer } from '../audio/player';
import { refreshPreview } from '../audio/itunes';
import type { DaySpec } from '../types/dayspec';
import { assemblyTimes, silentTimes } from './assemblyTimes';

type Mode = 'silent' | 'loading' | 'playing' | 'ready';
export function useAssembly(spec: DaySpec, assembled = false) {
  const times = useMemo(() => assemblyTimes(spec), [spec]);
  const quiet = useMemo(() => silentTimes(times), [times]);
  const [mode, setMode] = useState<Mode>('ready');
  const [notice, setNotice] = useState('');
  const [at, setAt] = useState(Infinity);
  const run = useRef<AbortController | null>(null);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stop = useCallback(() => {
    run.current?.abort();
    run.current = null;
    setMode('ready');
    setAt(Infinity);
  }, []);
  // Обновляем React только на долях, а часы берём у самого проигрывателя.
  const follow = useCallback(
    (signal: AbortSignal, marks: number[], clock: () => number, finish: () => void) => {
      if (reduced()) {
        setAt(Infinity);
        finish();
        return;
      }
      const thresholds = [...new Set(marks)].sort((a, b) => a - b);
      let index = 0,
        frame = 0;
      setAt(-1);
      function tick() {
        if (signal.aborted) return;
        if (reduced()) {
          setAt(Infinity);
          finish();
          return;
        }
        const sec = clock();
        if (signal.aborted) return;
        if (sec >= thresholds[index]) {
          while (index < thresholds.length && sec >= thresholds[index]) index++;
          setAt(sec);
        }
        if (index >= thresholds.length) {
          finish();
          return;
        }
        frame = requestAnimationFrame(tick);
      }
      signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true });
      tick();
    },
    [],
  );
  const silent = useCallback(
    (message = '') => {
      stop();
      setNotice(message);
      const session = new AbortController();
      run.current = session;
      setMode('silent');
      const start = performance.now();
      follow(
        session.signal,
        quiet,
        () => (performance.now() - start) / 1000,
        () => {
          setMode('ready');
          setAt(Infinity);
        },
      );
    },
    [stop, quiet, follow],
  );
  useEffect(() => {
    if (!assembled) silent();
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      if (mq.matches) setAt(Infinity);
    };
    mq.addEventListener('change', change);
    return () => {
      run.current?.abort();
      mq.removeEventListener('change', change);
    };
  }, [silent, assembled]);
  async function sound() {
    if (mode === 'playing' || mode === 'loading') {
      stop();
      setNotice('');
      return;
    }
    stop();
    setNotice('');
    setMode('loading');
    const session = new AbortController();
    run.current = session;
    const signal = session.signal;
    const player = createPlayer();
    signal.addEventListener('abort', () => player.stop(), { once: true });
    const fail = () => {
      if (!signal.aborted) silent('Фрагмент сейчас недоступен. Страница собралась без звука.');
    };
    const timer = setTimeout(fail, 9000);
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
    try {
      const song = spec.song;
      let url = song?.previewUrl;
      if (!url && song?.trackId) url = await refreshPreview(song.trackId, signal);
      if (signal.aborted) return;
      if (!url) {
        fail();
        return;
      }
      const off = player.onEnded(() => {
        if (!signal.aborted) stop();
      });
      signal.addEventListener('abort', off, { once: true });
      try {
        await player.play(url, 0);
      } catch (error) {
        if (signal.aborted || !song?.previewUrl || !song.trackId) throw error;
        const fresh = await refreshPreview(song.trackId, signal);
        if (!fresh || signal.aborted) throw error;
        await player.play(fresh, 0);
      }
      if (signal.aborted) {
        player.stop();
        return;
      }
      clearTimeout(timer);
      setMode('playing');
      let last = -1,
        lastMove = performance.now();
      follow(
        signal,
        times,
        () => {
          const sec = player.currentTime() ?? 0;
          if (sec !== last) {
            last = sec;
            lastMove = performance.now();
          } else if (performance.now() - lastMove > 8000) fail();
          return sec;
        },
        () => setAt(Infinity),
      );
    } catch {
      fail();
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    mode,
    notice,
    silent: () => silent(),
    sound,
    at,
    times: mode === 'silent' ? quiet : times,
  };
}

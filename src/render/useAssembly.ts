import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPlayer } from '../audio/player';
import { refreshPreview } from '../audio/itunes';
import type { DaySpec } from '../types/dayspec';
import { assemblyStart, assemblyTimes, silentTimes } from './assemblyTimes';
import { reveal } from './reveal';

type Mode = 'silent' | 'loading' | 'playing' | 'ready';
/** Звук включается не позже, чем за столько секунд до пика: главный кадр ложится под музыку. */
const LEAD_SEC = 0.7;
/** Сколько главный кадр ждёт звук после своего срока, прежде чем лечь без него. */
const HOLD_SEC = 1.4;
/** Примерно столько браузер добирает фрагмент с середины: звук стартует с запасом вперёд. */
const BUFFER_SEC = 0.5;

/**
 * Сборка дня. Страница начинает собираться сразу по касанию, по часам песни с секунды
 * `assemblyStart`; звук подхватывает её с той же секунды, когда фрагмент загрузится.
 * Главный кадр ждёт звук и ложится ровно на пик.
 */
export function useAssembly(spec: DaySpec, assembled = false) {
  const times = useMemo(() => assemblyTimes(spec), [spec]);
  const quiet = useMemo(() => silentTimes(times), [times]);
  const [mode, setMode] = useState<Mode>('ready');
  const [notice, setNotice] = useState('');
  const [assembling, setAssembling] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const run = useRef<AbortController | null>(null);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stop = useCallback(() => {
    run.current?.abort();
    run.current = null;
    setMode('ready');
    setAssembling(false);
  }, []);

  /** Запустить появление кусочков; сборка закончится сама или вместе с сеансом. */
  const assemble = useCallback((signal: AbortSignal, delays: number[], holdHero: boolean) => {
    const el = root.current;
    if (!el || reduced()) return null;
    const show = reveal(el, delays, holdHero);
    setAssembling(true);
    signal.addEventListener('abort', () => show.cancel(), { once: true });
    void show.done.then(() => {
      if (!signal.aborted) setAssembling(false);
    });
    return show;
  }, []);

  const silent = useCallback(
    (message = '') => {
      stop();
      setNotice(message);
      const session = new AbortController();
      run.current = session;
      setMode('silent');
      const show = assemble(session.signal, quiet, false);
      if (!show) setMode('ready');
      else
        void show.done.then(() => {
          if (!session.signal.aborted) setMode('ready');
        });
    },
    [stop, quiet, assemble],
  );

  useEffect(() => {
    if (!assembled) silent();
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      if (mq.matches) {
        run.current?.abort();
        setAssembling(false);
      }
    };
    mq.addEventListener('change', change);
    return () => {
      run.current?.abort();
      mq.removeEventListener('change', change);
    };
  }, [silent, assembled]);

  /**
   * Звук дня. `withAssembly` — собирать страницу под песню (при первом открытии);
   * без него песня просто звучит над уже собранной страницей (после перелистывания).
   */
  async function sound(withAssembly = true) {
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

    const start = assemblyStart(spec);
    const peak = spec.reveal.peakSec;
    const began = performance.now();
    const songNow = () => start + (performance.now() - began) / 1000;
    // Страница собирается сразу, не дожидаясь сети: часы страницы — секунды песни.
    const show = withAssembly
      ? assemble(
          signal,
          times.map((t) => t - start),
          peak !== null,
        )
      : null;
    const heroAt = peak !== null ? peak - start : 0;
    const hold = setTimeout(() => show?.land(0), (heroAt + HOLD_SEC) * 1000);
    signal.addEventListener('abort', () => clearTimeout(hold), { once: true });

    // Сдались: звук не пришёл. Сборка продолжается, поздний фрагмент уже не включится.
    let gaveUp = false;
    const quietly = (message: string) => {
      if (signal.aborted || gaveUp) return;
      gaveUp = true;
      clearTimeout(hold);
      // Главный кадр всё равно ложится последним, в свой срок.
      show?.land((heroAt - (performance.now() - began) / 1000) * 1000);
      setMode(show ? 'silent' : 'ready');
      setNotice(message);
      player.stop();
      if (show)
        void show.done.then(() => {
          if (!signal.aborted) setMode('ready');
        });
    };
    const unavailable = () => quietly('Фрагмент сейчас недоступен. Страница собралась без звука.');
    const timer = setTimeout(unavailable, 9000);
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
    try {
      const song = spec.song;
      let url = song?.previewUrl;
      if (!url && song?.trackId) url = await refreshPreview(song.trackId, signal);
      if (signal.aborted || gaveUp) return;
      if (!url) {
        unavailable();
        return;
      }
      let source = url;
      // Фрагмент кончился, а день ещё открыт — песня идёт по кругу с начала.
      const off = player.onEnded(() => {
        if (!signal.aborted) void player.play(source, 0).catch(() => stop());
      });
      signal.addEventListener('abort', off, { once: true });
      // Звук подхватывает сборку с той секунды, до которой она дойдёт к началу звука,
      // но не позже LEAD_SEC до пика.
      const from = () => {
        if (!show) return 0;
        const ahead = songNow() + BUFFER_SEC;
        return Math.max(0, peak !== null ? Math.min(ahead, peak - LEAD_SEC) : ahead);
      };
      try {
        await player.play(source, from());
      } catch (error) {
        if (signal.aborted || gaveUp || !song?.previewUrl || !song.trackId) throw error;
        const fresh = await refreshPreview(song.trackId, signal, true);
        if (!fresh || signal.aborted || gaveUp) throw error;
        source = fresh;
        await player.play(fresh, from());
      }
      if (signal.aborted || gaveUp) {
        player.stop();
        return;
      }
      clearTimeout(timer);
      setMode('playing');
      if (show) {
        const heard = player.currentTime() ?? songNow();
        // Звук отстал от страницы — оставшиеся кусочки ждут его доли.
        show.shift((songNow() - heard) * 1000);
        if (peak !== null) {
          clearTimeout(hold);
          show.land((peak - heard) * 1000);
        }
      }
    } catch (error) {
      // Браузер не дал включить звук без нажатия: страница собирается тихо, кнопка звука остаётся.
      if (error instanceof DOMException && error.name === 'NotAllowedError') quietly('');
      else unavailable();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    mode,
    notice,
    silent: () => silent(),
    sound,
    /** Корень разворота: сюда DaySpread вешает ref. */
    root,
    assembling,
  };
}

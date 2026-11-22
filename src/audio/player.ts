/**
 * Плеер фрагмента: звук только потоком через <audio>.
 *
 * Все плееры играют через один общий <audio>. Safari на iPhone разрешает звук только тому
 * элементу, который уже запускали из касания, а между касанием и звуком у нас запрос к Apple.
 * Поэтому общий элемент «разблокируется» беззвучно при первом касании страницы,
 * и дальше песня может начаться после ответа сети.
 */
export interface Player {
  /** Запустить фрагмент с секунды fromSec. */
  play(url: string, fromSec: number): Promise<void>;
  stop(): void;
  /** Текущая секунда фрагмента; null, если сейчас не играет. */
  currentTime(): number | null;
  /** Подписка на конец фрагмента; возвращает отписку. */
  onEnded(cb: () => void): () => void;
}

/** Десятая доля секунды тишины (WAV, 8 кГц, 8 бит): этим звуком элемент разблокируется в касании. */
function silence() {
  const n = 800;
  const wav = new DataView(new ArrayBuffer(44 + n));
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => wav.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  wav.setUint32(4, 36 + n, true);
  text(8, 'WAVEfmt ');
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, 1, true);
  wav.setUint32(24, 8000, true);
  wav.setUint32(28, 8000, true);
  wav.setUint16(32, 1, true);
  wav.setUint16(34, 8, true);
  text(36, 'data');
  wav.setUint32(40, n, true);
  for (let i = 0; i < n; i++) wav.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
}
let quiet = '';

let shared: HTMLAudioElement | null = null;
let owner: object | null = null;
let unlocked = false;

function element() {
  if (!shared) {
    shared = new Audio();
    shared.preload = 'none';
  }
  return shared;
}

function unlock() {
  if (unlocked || owner) return;
  const audio = element();
  if (audio.src && audio.src !== quiet) return;
  unlocked = true;
  quiet ||= silence();
  audio.src = quiet;
  audio.play().then(
    () => {
      if (!owner) audio.pause();
    },
    () => {
      unlocked = false;
    },
  );
}

if (typeof window !== 'undefined')
  for (const type of ['pointerdown', 'keydown'] as const)
    window.addEventListener(type, unlock, { capture: true, passive: true });

export function createPlayer(): Player {
  const me = {};
  const mine = () => owner === me;
  return {
    async play(url, fromSec) {
      const audio = element();
      owner = me;
      if (audio.src !== url) audio.src = url;
      audio.currentTime = Math.max(0, fromSec);
      try {
        await audio.play();
      } catch (err) {
        if (mine()) owner = null;
        throw err;
      }
      // Пока шла загрузка, звук мог перейти к другому дню.
      if (!mine()) throw new DOMException('Звук занят другим днём', 'AbortError');
    },
    stop() {
      if (!mine()) return;
      owner = null;
      shared?.pause();
    },
    currentTime() {
      return mine() && shared && !shared.paused ? shared.currentTime : null;
    },
    onEnded(cb) {
      const audio = element();
      const ended = () => {
        if (mine()) cb();
      };
      audio.addEventListener('ended', ended);
      return () => audio.removeEventListener('ended', ended);
    },
  };
}

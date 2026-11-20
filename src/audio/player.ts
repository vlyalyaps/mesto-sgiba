/**
 * Плеер фрагмента: звук только потоком через <audio>, только по нажатию человека
 * (иначе Safari на iPhone промолчит). Базовая версия; плавное появление и затухание,
 * ошибки и перезапрос ссылки — направление «ввод и звук».
 */
export interface Player {
  /** Запустить фрагмент с секунды fromSec. Вызывать из обработчика нажатия. */
  play(url: string, fromSec: number): Promise<void>;
  stop(): void;
  /** Текущая секунда фрагмента; null, если сейчас не играет. */
  currentTime(): number | null;
  /** Подписка на конец фрагмента; возвращает отписку. */
  onEnded(cb: () => void): () => void;
}

export function createPlayer(): Player {
  const audio = new Audio();
  audio.preload = 'none';
  let playing = false;
  audio.addEventListener('ended', () => {
    playing = false;
  });

  return {
    async play(url, fromSec) {
      if (audio.src !== url) audio.src = url;
      audio.currentTime = Math.max(0, fromSec);
      playing = true;
      try {
        await audio.play();
      } catch (err) {
        playing = false;
        throw err;
      }
    },
    stop() {
      audio.pause();
      playing = false;
    },
    currentTime() {
      return playing ? audio.currentTime : null;
    },
    onEnded(cb) {
      audio.addEventListener('ended', cb);
      return () => audio.removeEventListener('ended', cb);
    },
  };
}

import { useEffect, useState } from 'react';
import type { PhotoMode, Rect } from '../types/dayspec';
import { fitRegion } from './geometry';
import { loadImage, processPhoto, readyPhoto } from './photoModes';

export interface PhotoLook {
  mode: PhotoMode;
  duo: [string, string];
  grain: number;
}

interface Shown {
  url: string;
  width: number;
  height: number;
  processed: boolean;
}

/**
 * Фото в режиме дня. Пока режим считается, показываем исходник в тех же размерах,
 * поэтому ничего не прыгает; готовый результат подменяет его без сдвига.
 */
export function usePhoto(src: string, look: PhotoLook): Shown | null {
  const { mode, duo, grain } = look;
  const duoKey = duo.join('');
  const [shown, setShown] = useState<Shown | null>(() => {
    const hit = readyPhoto(src, mode, duo, grain);
    return hit ? { ...hit, processed: true } : null;
  });

  useEffect(() => {
    let live = true;
    const hit = readyPhoto(src, mode, duo, grain);
    if (hit) {
      setShown({ ...hit, processed: true });
      return;
    }
    setShown(null);
    loadImage(src)
      .then((img) => {
        if (!live) return;
        setShown({ url: src, width: img.width, height: img.height, processed: false });
        return processPhoto(src, mode, duo, grain).then((out) => {
          if (live) setShown({ ...out, processed: true });
        });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // duo — массив: следим за его содержимым через duoKey.
  }, [src, mode, duoKey, grain]);

  return shown;
}

interface PhotoProps {
  src: string;
  look: PhotoLook;
  /** Фрагмент снимка (доли 0..1), который должен закрыть окно. */
  region: Rect;
  /** Отношение ширины окна к высоте. */
  aspect: number;
}

/** Окно с фото: картинка кладётся по region, размеры в долях окна, поэтому окно любое. */
export function Photo({ src, look, region, aspect }: PhotoProps) {
  const shown = usePhoto(src, look);
  if (!shown) return null;
  const f = fitRegion(shown.width, shown.height, aspect, 1, region);
  return (
    <img
      className="ph-img"
      src={shown.url}
      alt=""
      draggable={false}
      decoding="async"
      style={{
        left: `${f.left * 100}%`,
        top: `${f.top * 100}%`,
        width: `${f.width * 100}%`,
        height: `${f.height * 100}%`,
      }}
    />
  );
}

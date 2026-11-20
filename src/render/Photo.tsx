import { useEffect, useState } from 'react';
import type { PhotoMode } from '../types/dayspec';

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

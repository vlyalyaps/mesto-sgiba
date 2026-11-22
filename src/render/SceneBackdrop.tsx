import type { DaySpec } from '../types/dayspec';
import { textureUrl } from './assets';

/** Фон за книгой, который выбрал автор. Один и тот же в редакторе и в галерее. */
export function SceneBackdrop({ spec }: { spec: DaySpec }) {
  const scene = spec.page.sheet?.scene;
  if (!scene || (!scene.color && !scene.texture)) return null;
  const url = textureUrl(scene.texture, spec.photos);
  const blur = scene.blur ?? 0;
  return (
    <div className="sheet-scene" style={{ backgroundColor: scene.color }} aria-hidden="true">
      {url && (
        <i
          style={{
            // Размытый край не должен открывать цвет под картинкой.
            inset: blur ? -blur * 2 : 0,
            backgroundImage: `url("${url}")`,
            backgroundColor: scene.color,
            backgroundBlendMode: scene.color ? 'multiply' : undefined,
            filter: blur ? `blur(${blur}px)` : undefined,
          }}
        />
      )}
      {!!scene.dim && <b style={{ opacity: scene.dim }} />}
    </div>
  );
}

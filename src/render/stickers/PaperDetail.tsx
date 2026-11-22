import type { DaySpec } from '../../types/dayspec';

export function PaperDetail({ motif, spec }: { motif: string; spec: DaySpec }) {
  if (motif === 'paper-swatches') {
    const [shadow, light] = spec.duo;
    const middle = `color-mix(in srgb, ${shadow}, ${light} 55%)`;
    return (
      <span className="paper-scrap swatch-slip" aria-hidden="true">
        {[shadow, middle, light].map((color, index) => (
          <i key={index} style={{ backgroundColor: color }} />
        ))}
      </span>
    );
  }

  if (motif === 'paper-film') {
    return (
      <span className="film-offcut" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    );
  }

  const crop = spec.photos.find((photo) => photo.role === 'key')?.crop;
  return (
    <span
      className={`paper-scrap ${motif === 'paper-graph' ? 'graph-scrap' : 'tracing-scrap'}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 156 53" preserveAspectRatio="xMidYMid meet">
        <path d="M15 20l1-11 17-1m52 0 17 1v10m-87 13 1 10 17 1m52 0 17-1 .5-10M117 19l22-2m-23 9 27-2m-25 9 12-2m-13 8 21-2" />
        {crop && (
          <rect
            className="pencil-drift"
            x={16 + crop.x * 84}
            y={9 + crop.y * 33}
            width={crop.w * 84}
            height={crop.h * 33}
            rx="1"
          />
        )}
      </svg>
    </span>
  );
}

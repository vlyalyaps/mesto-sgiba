import { dayGlow } from '../../gallery/glow';
import { SceneBackdrop } from '../../render/SceneBackdrop';
import type { DaySpec } from '../../types/dayspec';

const DUST: [x: number, y: number][] = [
  [6, 18],
  [13, 71],
  [22, 9],
  [31, 88],
  [44, 5],
  [53, 93],
  [66, 8],
  [75, 84],
  [88, 22],
  [94, 63],
  [4, 48],
  [97, 39],
];
const SPARKS: [x: number, y: number, size: number][] = [
  [8, 28, 22],
  [91, 14, 14],
  [93, 78, 26],
];

/** Всё, что галерея покажет за книгой: настройка фона не должна работать вслепую. */
export function Surroundings({ spec }: { spec: DaySpec }) {
  const scene = spec.page.sheet?.scene;
  const glow = dayGlow(spec);
  return (
    <div className="ed-around" style={{ color: glow }} aria-hidden="true">
      <SceneBackdrop spec={spec} />
      <i className="ed-around-glow" style={{ opacity: scene?.glowPower }} />
      {scene?.orbits !== false && (
        <svg className="ed-around-orbit" viewBox="0 0 200 110">
          <ellipse cx="100" cy="55" rx="99" ry="34" transform="rotate(-11 100 55)" />
        </svg>
      )}
      {scene?.stars !== false &&
        DUST.map(([x, y]) => (
          <b key={`${x}-${y}`} className="ed-around-dust" style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      {scene?.sparks !== false &&
        SPARKS.map(([x, y, size]) => (
          <svg
            key={x}
            className="ed-around-spark"
            viewBox="0 0 40 64"
            style={{ left: `${x}%`, top: `${y}%`, width: size }}
          >
            <path d="M20 0Q22 29 40 32 22 35 20 64 18 35 0 32 18 29 20 0z" />
          </svg>
        ))}
    </div>
  );
}

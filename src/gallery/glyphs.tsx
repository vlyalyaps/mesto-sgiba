import type { CSSProperties } from 'react';

/** Четырёхлучевая искра с мягким светом: длинные лучи по вертикали, как на наброске. */
export function Sparkle({ style, z }: { style?: CSSProperties; z: number }) {
  return (
    <svg className="g-sparkle" viewBox="0 0 40 64" style={style} data-z={z} aria-hidden="true">
      <path d="M20 0C21.6 22 24 28.6 40 32 24 35.4 21.6 42 20 64 18.4 42 16 35.4 0 32 16 28.6 18.4 22 20 0Z" />
    </svg>
  );
}

/** Две орбиты вокруг листа: штрих ползёт по эллипсу, как след спутника. */
export function Orbits() {
  return (
    <svg className="g-orbits" viewBox="-500 -200 1000 400" aria-hidden="true">
      <ellipse className="g-orbit g-orbit-1" rx="470" ry="120" />
      <ellipse className="g-orbit g-orbit-2" rx="400" ry="168" />
      <circle className="g-moon" r="5">
        <animateMotion
          dur="22s"
          repeatCount="indefinite"
          path="M470 0A470 120 0 1 1-470 0A470 120 0 1 1 470 0"
        />
      </circle>
    </svg>
  );
}

/** Значок звука: четыре полоски, при игре прыгают в такт. */
export function Equalizer() {
  return (
    <svg className="g-eq" viewBox="0 0 20 20" aria-hidden="true">
      {[3, 7.5, 12, 16.5].map((x, i) => (
        <rect
          key={x}
          x={x - 1.4}
          y="4"
          width="2.8"
          height="12"
          rx="1.4"
          style={{ '--n': i } as CSSProperties}
        />
      ))}
    </svg>
  );
}

/** Знак проекта: лист, согнутый пополам, и искра на сгибе. */
export function Mark() {
  return (
    <svg className="g-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 8.5 15.6 5v21L4 29.5zM28 8.5 16.4 5v21L28 29.5z" />
      <path
        className="g-mark-spark"
        d="M16 0c.4 2.7.9 3.5 3 4-2.1.5-2.6 1.3-3 4-.4-2.7-.9-3.5-3-4 2.1-.5 2.6-1.3 3-4Z"
      />
    </svg>
  );
}

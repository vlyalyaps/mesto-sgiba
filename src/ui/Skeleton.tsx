import type { CSSProperties } from 'react';

/** Заглушка по форме будущего контента. Контейнер вокруг отмечайте aria-busy. */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

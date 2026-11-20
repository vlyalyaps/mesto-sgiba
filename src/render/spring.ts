/**
 * Пружина в терминах Apple: response — за сколько секунд значение приходит к цели,
 * damping — затухание (1 — без перелёта). Шаг полунеявным Эйлером.
 */
export function springStep(
  x: number,
  v: number,
  target: number,
  dt: number,
  response: number,
  damping: number,
): [number, number] {
  const k = ((2 * Math.PI) / response) ** 2;
  const c = (4 * Math.PI * damping) / response;
  const nv = v + (-k * (x - target) - c * v) * dt;
  return [x + nv * dt, nv];
}

/** Куда долетит жест по инерции (формула Apple, затухание 0.998): скорость в ед./с. */
export function project(velocity: number, rate = 0.998): number {
  return ((velocity / 1000) * rate) / (1 - rate);
}

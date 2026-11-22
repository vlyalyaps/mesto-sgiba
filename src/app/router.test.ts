import { describe, expect, it } from 'vitest';
import { parseHash, routeHref } from './router';

describe('parseHash', () => {
  it('ведёт на стол со всеми днями по умолчанию', () => {
    expect(parseHash('')).toEqual({ name: 'gallery' });
    expect(parseHash('#/')).toEqual({ name: 'gallery' });
    expect(parseHash('#/что-то')).toEqual({ name: 'gallery' });
  });

  it('узнаёт запись и день', () => {
    expect(parseHash('#/new')).toEqual({ name: 'new' });
    expect(parseHash('#/day/2026-11-19-047')).toEqual({ name: 'day', id: '2026-11-19-047' });
  });

  it('узнаёт галерею дней и день в ней', () => {
    expect(parseHash('#/gallery')).toEqual({ name: 'gallery' });
    expect(parseHash('#/gallery/2026-11-19-047')).toEqual({
      name: 'gallery',
      id: '2026-11-19-047',
    });
    expect(routeHref({ name: 'gallery', id: '2026-11-19-047' })).toBe('#/gallery/2026-11-19-047');
  });

  it('собирает ссылку обратно', () => {
    expect(parseHash(routeHref({ name: 'day', id: '2026-11-19-047' }))).toEqual({
      name: 'day',
      id: '2026-11-19-047',
    });
  });
});

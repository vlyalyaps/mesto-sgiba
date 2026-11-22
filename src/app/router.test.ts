import { describe, expect, it } from 'vitest';
import { parseHash, routeHref } from './router';

describe('parseHash', () => {
  it('по умолчанию открывает галерею', () => {
    expect(parseHash('')).toEqual({ name: 'gallery' });
    expect(parseHash('#/')).toEqual({ name: 'gallery' });
    expect(parseHash('#/что-то')).toEqual({ name: 'gallery' });
  });

  it('узнаёт запись, галерею дней и день в ней', () => {
    expect(parseHash('#/new')).toEqual({ name: 'new' });
    expect(parseHash('#/gallery')).toEqual({ name: 'gallery' });
    expect(parseHash('#/gallery/2026-11-19-047')).toEqual({
      name: 'gallery',
      id: '2026-11-19-047',
    });
  });

  it('старые адреса книг ведут в галерею', () => {
    expect(parseHash('#/month/2026-11')).toEqual({ name: 'gallery' });
    expect(parseHash('#/month/2026-11/contents')).toEqual({ name: 'gallery' });
    expect(parseHash('#/day/2026-11-19-047')).toEqual({ name: 'gallery', id: '2026-11-19-047' });
  });

  it('узнаёт правку своего дня', () => {
    const route = { name: 'edit', id: '2026-11-19-047' } as const;
    expect(parseHash(routeHref(route))).toEqual(route);
  });

  it('собирает ссылку обратно', () => {
    expect(routeHref({ name: 'new' })).toBe('#/new');
    expect(routeHref({ name: 'gallery' })).toBe('#/gallery');
    expect(parseHash(routeHref({ name: 'gallery', id: '2026-11-19-047' }))).toEqual({
      name: 'gallery',
      id: '2026-11-19-047',
    });
  });
});

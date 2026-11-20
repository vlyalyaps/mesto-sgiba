import { describe, expect, it } from 'vitest';
import { parseHash, routeHref } from './router';

describe('parseHash', () => {
  it('ведёт на архив по умолчанию', () => {
    expect(parseHash('')).toEqual({ name: 'archive' });
    expect(parseHash('#/')).toEqual({ name: 'archive' });
    expect(parseHash('#/что-то')).toEqual({ name: 'archive' });
  });

  it('узнаёт запись и день', () => {
    expect(parseHash('#/new')).toEqual({ name: 'new' });
    expect(parseHash('#/day/2026-11-19-047')).toEqual({ name: 'day', id: '2026-11-19-047' });
  });

  it('собирает ссылку обратно', () => {
    expect(parseHash(routeHref({ name: 'day', id: '2026-11-19-047' }))).toEqual({
      name: 'day',
      id: '2026-11-19-047',
    });
  });
});

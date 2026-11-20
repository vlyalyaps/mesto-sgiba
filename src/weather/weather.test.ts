import { afterEach, expect, it, vi } from 'vitest';
import { getDayWeather } from './index';
afterEach(() => vi.unstubAllGlobals());
const sample = (time: string) =>
  Response.json({
    hourly: {
      time: [time],
      temperature_2m: [-1.5],
      weather_code: [71],
      wind_speed_10m: [3],
      is_day: [0],
    },
  });
it('выключенная погода не делает запросов', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  expect(await getDayWeather({ enabled: false })).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});
it('час EXIF важнее времени записи и не зависит от часового пояса браузера', async () => {
  const fetch = vi.fn().mockResolvedValue(sample('2024-12-30T02:00'));
  vi.stubGlobal('fetch', fetch);
  expect(
    await getDayWeather({
      enabled: true,
      takenAt: '2024-12-29T21:34:00Z',
      recordedAt: '2025-01-01T12:00:00Z',
    }),
  ).toEqual({ hour: 2, place: 'Талдыкорган', tempC: -1.5, code: 71, windKph: 3, isDay: false });
  expect(fetch.mock.calls[0][0]).toContain('archive-api.open-meteo.com');
});
it('неполные данные основного города — снимок с явным названием запасного', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ hourly: { time: [] } }))
    .mockResolvedValueOnce(sample('2025-04-01T12:00'));
  vi.stubGlobal('fetch', fetch);
  const w = await getDayWeather({
    enabled: true,
    takenAt: 'bad',
    recordedAt: '2025-04-01T12:30:00',
  });
  expect(w?.place).toBe('Алматы');
  expect(fetch.mock.calls[1][0]).toContain('latitude=43.2389');
});
it('отмена не начинает запрос для запасного города', async () => {
  const abort = new AbortController();
  const fetch = vi.fn(() => {
    abort.abort();
    throw Error();
  });
  vi.stubGlobal('fetch', fetch);
  await expect(getDayWeather({ enabled: true, signal: abort.signal })).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});

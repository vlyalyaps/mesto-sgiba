import type { WeatherSnapshot } from '../types/dayspec';

export const places = {
  taldykorgan: { name: 'Талдыкорган', latitude: 45.0156, longitude: 78.3739 },
  almaty: { name: 'Алматы', latitude: 43.2389, longitude: 76.8897 },
} as const;
export interface WeatherOptions {
  /** Значение переключателя «Добавить погоду» в форме. */
  enabled: boolean;
  takenAt?: string;
  recordedAt?: string;
  place?: keyof typeof places;
  signal?: AbortSignal;
}
export interface WeatherReading extends WeatherSnapshot {
  windKph?: number;
  isDay?: boolean;
}
const zone = 'Asia/Almaty';
const localFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: zone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});
function localHour(date: Date) {
  const parts = Object.fromEntries(localFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':00';
}
function hourOf(value?: string) {
  if (!value) return;
  const iso = value.replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T');
  // EXIF без смещения уже содержит местный час снимка.
  const local = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.exec(iso);
  if (local) {
    const d = new Date(local[1] + 'T00:00:00Z');
    return !Number.isNaN(+d) && d.toISOString().startsWith(local[1]) && Number(local[2]) < 24
      ? local[1] + 'T' + local[2] + ':00'
      : undefined;
  }
  if (!/(?:Z|[+-]\d\d:\d\d)$/i.test(iso)) return;
  const d = new Date(iso);
  return Number.isNaN(+d) ? undefined : localHour(d);
}
interface Hourly {
  time?: string[];
  temperature_2m?: Array<number | null>;
  weather_code?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
  is_day?: Array<number | null>;
}
async function lookup(
  target: string,
  place: keyof typeof places,
  signal?: AbortSignal,
): Promise<WeatherReading | undefined> {
  const city = places[place],
    date = target.slice(0, 10);
  const archive =
    Date.parse(date + 'T00:00:00Z') <
    Date.parse(localHour(new Date()).slice(0, 10) + 'T00:00:00Z') - 5 * 86400000;
  const endpoint = archive
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast';
  const query = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    timezone: zone,
    start_date: date,
    end_date: date,
    hourly: 'temperature_2m,weather_code,wind_speed_10m,is_day',
  });
  const timeout = AbortSignal.timeout(4500);
  const res = await fetch(endpoint + '?' + query, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) return;
  const { hourly } = (await res.json()) as { hourly?: Hourly };
  const index = hourly?.time?.indexOf(target) ?? -1;
  if (index < 0) return;
  const tempC = hourly?.temperature_2m?.[index],
    code = hourly?.weather_code?.[index],
    wind = hourly?.wind_speed_10m?.[index],
    day = hourly?.is_day?.[index];
  if (
    typeof tempC !== 'number' ||
    !Number.isFinite(tempC) ||
    typeof code !== 'number' ||
    !Number.isInteger(code)
  )
    return;
  return {
    tempC,
    code,
    hour: Number(target.slice(11, 13)),
    place: city.name,
    ...(typeof wind === 'number' && Number.isFinite(wind) ? { windKph: wind } : {}),
    ...(day === 0 || day === 1 ? { isDay: day === 1 } : {}),
  };
}
/** Один снимок на запись. При отсутствии сети форма сохраняет день без погоды. */
export async function getDayWeather({
  enabled,
  takenAt,
  recordedAt,
  place = 'taldykorgan',
  signal,
}: WeatherOptions): Promise<WeatherReading | undefined> {
  if (!enabled) return;
  const target = hourOf(takenAt) ?? hourOf(recordedAt) ?? localHour(new Date());
  const cities: Array<keyof typeof places> = place === 'almaty' ? [place] : [place, 'almaty'];
  for (const city of cities) {
    signal?.throwIfAborted();
    try {
      const reading = await lookup(target, city, signal);
      if (reading) return reading;
    } catch {
      signal?.throwIfAborted();
    }
  }
}

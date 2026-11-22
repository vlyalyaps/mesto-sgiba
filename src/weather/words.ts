/**
 * Погода словами по коду WMO, который отдаёт Open-Meteo.
 * Ночью «солнечно» звучит странно, поэтому ясное небо после заката — «ясно».
 */
export function weatherWord(code: number, hour = 12): string {
  // Как у значка луны на листе: зимой в 17:00 уже темно.
  const night = hour >= 17 || hour < 7;
  if (code === 0) return night ? 'Ясно' : 'Солнечно';
  if (code === 1) return night ? 'Почти ясно' : 'Почти солнечно';
  if (code === 2) return 'Переменная облачность';
  if (code === 3) return 'Пасмурно';
  if (code === 45 || code === 48) return 'Туман';
  if (code >= 51 && code <= 57) return 'Морось';
  if (code === 66 || code === 67) return 'Ледяной дождь';
  if (code >= 61 && code <= 65) return 'Дождь';
  if (code >= 71 && code <= 77) return 'Снег';
  if (code >= 80 && code <= 82) return 'Ливень';
  if (code === 85 || code === 86) return 'Снегопад';
  if (code >= 95) return 'Гроза';
  return 'Облачно';
}

/** Что падает с неба: по этому сцена дня решает, лететь ли снегу или дождю. */
export function weatherFall(code: number): 'snow' | 'rain' | null {
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  return null;
}

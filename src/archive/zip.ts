/**
 * Папка дня в ZIP (fflate): text.md, photos/, song.json (trackId, ссылки, признаки),
 * cover.png, dayspec.json, why.json. Фрагменты песен в ZIP не кладём.
 * Владелец — направление «архив».
 */
export async function exportDay(id: string): Promise<Blob> {
  void id;
  throw new Error('exportDay: ещё не сделано');
}

/** Восстанавливает день из ZIP в архив; возвращает id дня. */
export async function importZip(file: File): Promise<string> {
  void file;
  throw new Error('importZip: ещё не сделано');
}

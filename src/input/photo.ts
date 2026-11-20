/** Фото, готовое для DayInput: уменьшенное до 1600 px по длинной стороне. */
export interface PreparedPhoto {
  blob: Blob;
  width: number;
  height: number;
  /** 3–5 цветов по убыванию доли, '#rrggbb' (k-means в OKLab на уменьшенной копии). */
  palette: string[];
  /** Средняя светлота 0..1. */
  lightness: number;
}

/** Готовит снимок из <input type="file">. Владелец — направление «ввод и звук». */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  void file;
  throw new Error('preparePhoto: ещё не сделано');
}

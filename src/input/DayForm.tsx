import type { DayInput } from '../types/dayspec';

export interface DayFormProps {
  /** Номер нового дня в архиве. */
  nextNumber: number;
  /**
   * Готовый день: DayInput (у своих фото src пустой) и сами фото по PhotoInput.id.
   * Дальше приложение сохраняет день и открывает книжку.
   */
  onDone(input: DayInput, photos: Record<string, Blob>): void;
  onCancel(): void;
}

/** Экран «Записать день»: текст, 1–5 фото, поиск песни. Владелец — направление «ввод и звук». */
export function DayForm({ onCancel }: DayFormProps) {
  return (
    <section className="placeholder">
      <p>Здесь будет запись дня: текст, фото и песня.</p>
      <button type="button" className="btn" onClick={onCancel}>
        Назад к архиву
      </button>
    </section>
  );
}

import type { DayInput } from '../types/dayspec';

/** День в архиве. DaySpec не храним: его пересчитывают из input при открытии. */
export interface StoredDay {
  /** 'YYYY-MM-DD-NNN', как DaySpec.id (см. dayId в src/rules). */
  id: string;
  /** У своих фото src пустой: его подставляют из photos при открытии. */
  input: DayInput;
  /** Сами фото по PhotoInput.id. */
  photos: Record<string, Blob>;
  createdAt: number;
}

// Временное хранилище в памяти. Направление «архив» заменит его на IndexedDB через Dexie,
// не меняя сигнатуры.
const memory = new Map<string, StoredDay>();

export async function saveDay(day: StoredDay): Promise<void> {
  memory.set(day.id, day);
}

/** Все дни, новые сверху. */
export async function listDays(): Promise<StoredDay[]> {
  return [...memory.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function getDay(id: string): Promise<StoredDay | undefined> {
  return memory.get(id);
}

export async function deleteDay(id: string): Promise<void> {
  memory.delete(id);
}

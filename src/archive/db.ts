import Dexie, { type EntityTable } from 'dexie';
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

/** IndexedDB «mesto-sgiba»: таблица days, ключ id, индекс createdAt. Фото лежат Blob'ами внутри записи. */
class ArchiveDb extends Dexie {
  days!: EntityTable<StoredDay, 'id'>;

  constructor() {
    super('mesto-sgiba');
    this.version(1).stores({ days: 'id, createdAt' });
  }
}

const db = new ArchiveDb();

export async function saveDay(day: StoredDay): Promise<void> {
  await db.days.put(day);
}

/** Все дни, новые сверху. */
export async function listDays(): Promise<StoredDay[]> {
  return db.days.orderBy('createdAt').reverse().toArray();
}

export async function getDay(id: string): Promise<StoredDay | undefined> {
  return db.days.get(id);
}

export async function deleteDay(id: string): Promise<void> {
  await db.days.delete(id);
}

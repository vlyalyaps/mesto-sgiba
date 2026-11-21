import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { fixtures } from '../fixtures';
import { buildDaySpec } from '../rules';
import type { StoredDay } from './db';

const saved: StoredDay[] = [];
vi.mock('./db', () => ({
  saveDay: async (d: StoredDay) => void saved.push(d),
  getDay: async (id: string) => saved.find((d) => d.id === id),
}));

const { exportDay, folderDirName, importZip, packDay, unpackDay } = await import('./zip');

const input = fixtures[0].input;
const bytes = (n: number) => Uint8Array.from([0xff, 0xd8, n, 1, 2, 3]);
const photos = Object.fromEntries(input.photos.map((p, i) => [p.id, bytes(i)]));
const withoutSrc = {
  ...input,
  photos: input.photos.map((p) => ({ ...p, src: '' })),
};

describe('folderDirName', () => {
  it('убирает недопустимые символы', () => {
    expect(folderDirName('2026-11-22', 'Что: «a/b»? <да>.')).toBe('2026-11-22 Что «ab» да');
    expect(folderDirName('2026-11-22', '???')).toBe('2026-11-22');
  });
});

describe('packDay / unpackDay', () => {
  it('кладёт ожидаемые файлы в одну папку', () => {
    const files = unzipSync(packDay(input, photos));
    const names = Object.keys(files);
    const dir = names[0].split('/')[0];
    expect(dir).toBe(folderDirName(input.date, buildDaySpec(input).folderName));
    expect(names.every((n) => n.startsWith(dir + '/'))).toBe(true);
    for (const f of ['text.md', 'day.json', 'dayspec.json', 'why.json'])
      expect(names).toContain(`${dir}/${f}`);
    for (const p of input.photos) expect(names).toContain(`${dir}/photos/${p.id}.jpg`);
    const md = strFromU8(files[`${dir}/text.md`]);
    expect(md).toContain(input.date);
    expect(md).toContain(input.text.trim());
    expect(md).toContain('Песня дня');
    expect(JSON.parse(strFromU8(files[`${dir}/day.json`])).photos[0].src).toBeUndefined();
  });

  it('экспорт → импорт даёт тот же DayInput и те же фото', () => {
    const back = unpackDay(packDay(input, photos));
    expect(back.input).toEqual(withoutSrc);
    expect(back.photos).toEqual(photos);
    expect(buildDaySpec({ ...back.input, photos: input.photos })).toEqual(buildDaySpec(input));
  });

  it('день без песни обходится без song.json', () => {
    const files = unzipSync(packDay({ ...input, song: null }, photos));
    expect(Object.keys(files).some((n) => n.endsWith('song.json'))).toBe(false);
    expect(unpackDay(packDay({ ...input, song: null }, photos)).input.song).toBeNull();
  });

  it('понятно ругается на чужой файл', () => {
    expect(() => unpackDay(new Uint8Array([1, 2, 3]))).toThrow(/ZIP/);
  });
});

describe('exportDay / importZip', () => {
  it('круг через архив с подменённым saveDay', async () => {
    const blobs = Object.fromEntries(
      Object.entries(photos).map(([k, v]) => [k, new Blob([v as BlobPart])]),
    );
    saved.push({ id: 'x', input, photos: blobs, createdAt: 1 });
    const zip = await exportDay('x');
    const file = new File([zip], 'day.zip');
    const id = await importZip(file);
    const restored = saved.at(-1)!;
    expect(id).toBe(restored.id);
    expect(restored.input).toEqual(withoutSrc);
    for (const [pid, v] of Object.entries(photos))
      expect(new Uint8Array(await restored.photos[pid].arrayBuffer())).toEqual(v);
  });

  it('экспорт несуществующего дня падает понятной ошибкой', async () => {
    await expect(exportDay('нет')).rejects.toThrow(/нет в архиве/);
  });
});

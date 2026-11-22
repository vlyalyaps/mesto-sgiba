import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { fixtures } from '../fixtures';
import { buildDaySpec, dayId } from '../rules';
import type { StoredDay } from './db';

const saved: StoredDay[] = [];
vi.mock('./db', () => ({
  saveDay: async (d: StoredDay) => void saved.push(d),
  getDay: async (id: string) => saved.find((d) => d.id === id),
}));

const { MAX_FILES, exportDay, folderDirName, importZip, packDay, unpackDay } =
  await import('./zip');

const base = fixtures[0].input;
// Номер не из демо-дней (иначе импорт переименует день), погода только с полями контракта.
const input = {
  ...base,
  number: 500,
  weather: base.weather && {
    tempC: base.weather.tempC,
    code: base.weather.code,
    hour: base.weather.hour,
    place: base.weather.place,
  },
};
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
    expect(() => unpackDay(new Uint8Array([1, 2, 3]))).toThrow(/не похож/);
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

describe('защита импорта', () => {
  const photo = {
    id: 'p1',
    src: '',
    width: 100,
    height: 80,
    palette: ['#aabbcc'],
    lightness: 0.5,
  };
  const day = (over: Record<string, unknown> = {}) => ({
    date: '2026-12-05',
    number: 7,
    text: 'Первый снег.',
    photos: [photo],
    song: null,
    ...over,
  });
  const zipOf = (d: unknown, extra: Record<string, Uint8Array> = {}, withPhoto = true) =>
    zipSync({
      'a/day.json': strToU8(JSON.stringify(d)),
      ...(withPhoto ? { 'a/photos/p1.jpg': bytes(1) } : {}),
      ...extra,
    });
  const song = (over: Record<string, unknown>) => ({
    source: 'itunes',
    trackId: 1,
    title: 't',
    artist: 'a',
    trackViewUrl: null,
    previewUrl: null,
    artworkUrl: null,
    year: 1999,
    genre: null,
    features: null,
    ...over,
  });

  it('нормальный архив проходит', () => {
    expect(unpackDay(zipOf(day())).input.photos[0].id).toBe('p1');
  });

  it('ссылки не из https и не с apple.com / mzstatic.com становятся null', () => {
    const s = song({
      trackViewUrl: 'javascript:alert(1)',
      previewUrl: 'http://audio-ssl.itunes.apple.com/a.m4a',
      artworkUrl: 'https://evil.example.com/a.jpg',
    });
    const out = unpackDay(zipOf(day({ song: s }))).input.song!;
    expect([out.trackViewUrl, out.previewUrl, out.artworkUrl]).toEqual([null, null, null]);
    const ok = unpackDay(
      zipOf(
        day({
          song: song({
            trackViewUrl: 'https://music.apple.com/kz/song/1',
            artworkUrl: 'https://is1-ssl.mzstatic.com/a.jpg',
            previewUrl: 'https://notapple.com/a.m4a',
          }),
        }),
      ),
    ).input.song!;
    expect(ok.trackViewUrl).toBe('https://music.apple.com/kz/song/1');
    expect(ok.artworkUrl).toBe('https://is1-ssl.mzstatic.com/a.jpg');
    expect(ok.previewUrl).toBeNull();
  });

  it('лишние ключи отбрасываются', () => {
    const { input } = unpackDay(zipOf(day({ evil: 1, photos: [{ ...photo, extra: 'x' }] })));
    expect(Object.keys(input).sort()).toEqual(['date', 'number', 'photos', 'song', 'text']);
    expect('extra' in input.photos[0]).toBe(false);
  });

  it('отклоняет id фото «../x», пустой набор, чужое настроение и нет файла фото', () => {
    expect(() => unpackDay(zipOf(day({ photos: [{ ...photo, id: '../x' }] })))).toThrow(/не похож/);
    expect(() => unpackDay(zipOf(day({ photos: [] })))).toThrow(/не похож/);
    expect(() => unpackDay(zipOf(day({ mood: 'rage' })))).toThrow(/не похож/);
    expect(() => unpackDay(zipOf(day(), {}, false))).toThrow(/photos\/p1\.jpg/);
    expect(() => unpackDay(zipOf(day({ date: '5.12.2026' })))).toThrow(/не похож/);
  });

  it('отклоняет архив с лишними путями, «..», множеством файлов и огромным файлом', () => {
    expect(() => unpackDay(zipOf(day(), { 'a/evil.exe': bytes(2) }))).toThrow(/не похож/);
    expect(() => unpackDay(zipOf(day(), { 'a/b/../../x.jpg': bytes(2) }))).toThrow(/не похож/);
    const many = Object.fromEntries(
      Array.from({ length: MAX_FILES }, (_, i) => [`a/photos/m${i}.jpg`, bytes(i)]),
    );
    expect(() => unpackDay(zipOf(day(), many))).toThrow(/не похож/);
    const big = new Uint8Array(16 * 1024 * 1024);
    expect(() => unpackDay(zipOf(day(), { 'a/photos/p1.jpg': big }))).toThrow(/не похож/);
  });

  it('импорт не перезаписывает существующий день и день демо', async () => {
    saved.length = 0;
    const zip = zipOf(day());
    const first = await importZip(new File([zip], 'a.zip'));
    expect(first).toBe('2026-12-05-007');
    const second = await importZip(new File([zip], 'a.zip'));
    expect(second).toBe('2026-12-05-008');
    expect(saved.map((d) => d.id)).toEqual(['2026-12-05-007', '2026-12-05-008']);
    expect(saved[1].input.number).toBe(8);

    const demo = fixtures[0].input;
    const id = await importZip(
      new File([zipOf(day({ date: demo.date, number: demo.number }))], 'd.zip'),
    );
    expect(id).toBe(dayId(demo.date, demo.number + 1));
  });
});

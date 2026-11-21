import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from './__fixtures__/itunes-search-creep.json';
import {
  isJunkTrack,
  normalizeTitle,
  parseSongLink,
  pickSongs,
  searchSongs,
  type ItunesTrack,
} from './itunes';

const results = fixture.results as ItunesTrack[];

describe('isJunkTrack', () => {
  it('ловит караоке, каверы, трибьюты и минусовки в названии, альбоме и исполнителе', () => {
    expect(isJunkTrack({ trackName: 'Creep (Radiohead Cover)' })).toBe(true);
    expect(isJunkTrack({ trackName: 'Creep', collectionName: 'Karaoke Hits 2020' })).toBe(true);
    expect(isJunkTrack({ trackName: 'Creep', artistName: 'Tribute Stars' })).toBe(true);
    expect(isJunkTrack({ trackName: 'Song (Instrumental)' })).toBe(true);
    expect(isJunkTrack({ trackName: 'Song (Originally Performed by X)' })).toBe(true);
    expect(isJunkTrack({ trackName: 'Song (made famous by X)' })).toBe(true);
    expect(isJunkTrack({ trackName: 'Группа крови (минус)' })).toBe(true);
    expect(isJunkTrack({ trackName: 'Группа крови (Караоке)' })).toBe(true);
  });
  it('не трогает обычные слова, где маркер лишь часть слова', () => {
    expect(isJunkTrack({ trackName: 'Discovery', artistName: 'Recover' })).toBe(false);
    expect(isJunkTrack({ trackName: 'Каверзный вопрос' })).toBe(false);
    expect(isJunkTrack({ trackName: 'Creep', artistName: 'Radiohead' })).toBe(false);
  });
});

describe('normalizeTitle', () => {
  it('убирает скобки, хвост после тире, знаки и регистр', () => {
    expect(normalizeTitle('Creep (New Version)')).toBe('creep');
    expect(normalizeTitle('Hello - Remastered 2011')).toBe('hello');
    expect(normalizeTitle('Don’t Stop Me Now!')).toBe('don t stop me now');
    expect(normalizeTitle('Группа  КРОВИ')).toBe('группа крови');
  });
});

describe('pickSongs на записанном ответе', () => {
  const songs = pickSongs(results);

  it('выкидывает каверы и склеивает дубли, максимум 5', () => {
    expect(songs.length).toBeLessThanOrEqual(5);
    expect(songs.map((s) => s.title)).not.toContain('Creep (Radiohead Cover)');
    expect(songs.map((s) => s.title)).not.toContain('Creep (Acoustic Cover)');
    const stp = songs.filter((s) => s.artist === 'Stone Temple Pilots');
    expect(stp).toHaveLength(1);
    expect(stp[0].trackId).toBe(3631572);
  });

  it('заполняет SongInput', () => {
    const first = songs[0];
    expect(first).toEqual({
      source: 'itunes',
      trackId: 1679849823,
      title: 'Creep (Acoustic)',
      artist: 'Radiohead',
      trackViewUrl: expect.stringContaining('music.apple.com'),
      previewUrl: expect.stringContaining('audio-ssl.itunes.apple.com'),
      artworkUrl: expect.stringMatching(/\/600x600bb\.jpg$/),
      year: 1992,
      genre: expect.any(String),
      features: null,
    });
  });

  it('берёт самый ранний год среди версий', () => {
    const [a, b] = results.filter((r) => r.artistName === 'Stone Temple Pilots').slice(0, 2);
    const picked = pickSongs([
      { ...a, releaseDate: '2005-01-01T00:00:00Z' },
      { ...b, releaseDate: '1993-05-05T00:00:00Z' },
    ]);
    expect(picked).toHaveLength(1);
    expect(picked[0].year).toBe(1993);
  });

  it('терпит записи без превью, обложки и даты', () => {
    const [s] = pickSongs([{ trackId: 1, trackName: 'A', artistName: 'B' }]);
    expect(s).toMatchObject({
      trackViewUrl: null,
      previewUrl: null,
      artworkUrl: null,
      year: null,
      genre: null,
    });
  });
});

describe('searchSongs', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ходит в каталог kz с нужными параметрами и возвращает разобранные песни', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await searchSongs('  creep radiohead ', undefined);
    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url.origin + url.pathname).toBe('https://itunes.apple.com/search');
    expect(url.searchParams.get('term')).toBe('creep radiohead');
    expect(url.searchParams.get('country')).toBe('kz');
    expect(url.searchParams.get('entity')).toBe('song');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(out.length).toBeGreaterThan(0);
  });

  it('пустой запрос не ходит в сеть', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchSongs('   ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('падает понятной ошибкой, если каталог не ответил', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })),
    );
    await expect(searchSongs('x')).rejects.toThrow(/Каталог/);
  });
});

describe('parseSongLink', () => {
  it('берёт trackId из параметра i', () => {
    expect(
      parseSongLink('https://music.apple.com/kz/album/creep/1679849414?i=1679849823&uo=4'),
    ).toBe(1679849823);
    expect(parseSongLink('https://itunes.apple.com/us/album/creep/123?i=456')).toBe(456);
  });
  it('берёт trackId из /song/…/<id>', () => {
    expect(parseSongLink('https://music.apple.com/us/song/creep/1679849823')).toBe(1679849823);
    expect(parseSongLink('https://music.apple.com/us/song/1679849823')).toBe(1679849823);
    expect(parseSongLink('music.apple.com/kz/song/creep/55/')).toBe(55);
  });
  it('null для альбомов, чужих сайтов и мусора', () => {
    expect(parseSongLink('https://music.apple.com/kz/album/creep/1679849414')).toBeNull();
    expect(parseSongLink('https://example.com/song/creep/123')).toBeNull();
    expect(parseSongLink('https://evilmusic.apple.com.example.org/song/x/1')).toBeNull();
    expect(parseSongLink('')).toBeNull();
    expect(parseSongLink('creep radiohead')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { fixtures } from './fixtures';

const HEX = /^#[0-9a-f]{6}$/i;

describe('контрольные дни', () => {
  it('их не меньше трёх', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
  });

  for (const { file, input, expect: want } of fixtures) {
    describe(file, () => {
      it('дата и номер в порядке', () => {
        expect(input.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(input.number).toBeGreaterThan(0);
        expect(input.text.trim().length).toBeGreaterThan(0);
      });

      it('от 1 до 5 фото с цветами и путями демо', () => {
        expect(input.photos.length).toBeGreaterThanOrEqual(1);
        expect(input.photos.length).toBeLessThanOrEqual(5);
        for (const p of input.photos) {
          expect(p.src).toMatch(/^demo\/photos\/[a-z0-9-]+\.(svg|jpg|jpeg|png|webp)$/);
          expect(p.palette.length).toBeGreaterThanOrEqual(3);
          for (const c of p.palette) expect(c).toMatch(HEX);
          expect(p.lightness).toBeGreaterThanOrEqual(0);
          expect(p.lightness).toBeLessThanOrEqual(1);
        }
      });

      it('песня хранит только ссылки, без звука', () => {
        if (!input.song) return;
        expect(input.song.previewUrl).toBeNull();
        const f = input.song.features;
        if (f) {
          expect(f.energy).toBeGreaterThanOrEqual(0);
          expect(f.energy).toBeLessThanOrEqual(1);
          expect(f.peakSec).toBeGreaterThanOrEqual(0);
          expect(f.peakSec).toBeLessThanOrEqual(30);
        }
      });

      it('задуманное название папки — 3–7 слов', () => {
        const words = want.folderName.trim().split(/\s+/);
        expect(words.length).toBeGreaterThanOrEqual(3);
        expect(words.length).toBeLessThanOrEqual(7);
      });
    });
  }
});

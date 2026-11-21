// Из корня репозитория: node scripts/letterpress/generate.mjs
// Chromium растрирует исходные OFL-глифы один раз, до сборки приложения.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const letters = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const fonts = {
  Literata: ['@fontsource-variable/literata', 'literata-cyrillic-wght-normal', '200 900'],
  Golos: ['@fontsource-variable/golos-text', 'golos-text-cyrillic-wght-normal', '400 900'],
  Plex: ['@fontsource/ibm-plex-mono', 'ibm-plex-mono-cyrillic-500-normal', '500'],
  Caveat: ['@fontsource/caveat', 'caveat-cyrillic-400-normal', '400'],
};
const designs = {
  news: ['900 103px Literata', '#262322'],
  gloss: ['900 105px Golos', '#fff3da'],
  book: ['italic 600 114px Literata', '#282423'],
  typewriter: ['500 91px Plex', '#334247'],
  stencil: ['900 110px Golos', '#26281f'],
  emboss: ['500 100px Plex', '#eee7cc'],
  kraft: ['700 104px Golos', '#52361d'],
  xerox: ['italic 900 101px Literata', '#232220'],
  neon: ['800 103px Golos', '#b8efdc'],
  note: ['400 124px Caveat', '#253d67'],
  pixel: ['800 99px Golos', '#24322c'],
};
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [name, [pkg, file, weight]] of Object.entries(fonts)) {
    const bytes = await readFile(`node_modules/${pkg}/files/${file}.woff2`);
    await page.evaluate(
      async ({ name, base, weight }) => {
        const face = new FontFace(name, `url(data:font/woff2;base64,${base})`, { weight });
        document.fonts.add(await face.load());
      },
      { name, base: bytes.toString('base64'), weight },
    );
  }
  for (const [pack, [font, color]] of Object.entries(designs)) {
    const dir = `public/letters/${pack}`;
    await mkdir(dir, { recursive: true });
    const stock = await readFile(new URL(`./stock/${pack}.webp`, import.meta.url));
    const cuts = await page.evaluate(
      async ({ pack, font, color, letters, base }) => {
        const sheet = new Image();
        sheet.src = 'data:image/webp;base64,' + base;
        await sheet.decode();
        return Array.from(letters, (char) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.font = font;
          const metrics = ctx.measureText(char);
          const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
          const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
          canvas.height = 124;
          canvas.width = Math.max(64, Math.min(148, Math.round((94 * inkWidth) / inkHeight + 15)));
          const w = canvas.width,
            h = canvas.height,
            code = char.codePointAt(0);
          ctx.save();
          if (code % 2) {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(sheet, 0, 0, w, h);
          ctx.restore();

          const ink = document.createElement('canvas');
          const pixel = pack === 'pixel';
          const factor = pixel ? 0.17 : 1;
          ink.width = Math.ceil(w * factor);
          ink.height = Math.ceil(h * factor);
          const pen = ink.getContext('2d');
          pen.scale(factor, factor);
          const scaleX = (w - 15) / inkWidth,
            scaleY = (h - 21 - (code % 5)) / inkHeight;
          pen.translate(
            7 + metrics.actualBoundingBoxLeft * scaleX,
            10 + metrics.actualBoundingBoxAscent * scaleY,
          );
          pen.scale(scaleX, scaleY);
          pen.font = font;
          pen.fillStyle = color;
          if (pack === 'emboss') {
            pen.fillStyle = '#020204';
            pen.fillText(char, 1.7, 2.4);
            pen.fillStyle = '#fffdf2';
            pen.fillText(char, -1.1, -1.3);
            pen.fillStyle = '#c2bfb0';
          }
          if (pack === 'neon') {
            pen.strokeStyle = '#43c7ac';
            pen.lineWidth = 3;
            pen.strokeText(char, 0, 0);
            pen.strokeStyle = color;
            pen.lineWidth = 1;
            pen.strokeText(char, 0, 0);
          } else {
            pen.fillText(char, 0, 0);
          }
          pen.setTransform(1, 0, 0, 1, 0, 0);
          if (pack === 'stencil') {
            pen.clearRect(w * 0.44, 0, 2.8, h);
            pen.clearRect(w * 0.73, h * 0.42, 2.5, h * 0.58);
          }
          if (pack === 'xerox' || pack === 'news' || pack === 'typewriter') {
            let state = code;
            for (let i = 0; i < 310; i++) {
              state = (Math.imul(state, 1664525) + 1013904223) | 0;
              pen.clearRect((state >>> 0) % w, (state >>> 12) % h, 1, 1);
            }
          }
          ctx.imageSmoothingEnabled = !pixel;
          ctx.drawImage(ink, 0, 0, w, h);
          return [code.toString(16), canvas.toDataURL('image/webp', 0.86).split(',')[1]];
        });
      },
      {
        pack,
        font,
        color,
        letters: letters + letters.toLowerCase(),
        base: stock.toString('base64'),
      },
    );
    for (const [code, bytes] of cuts)
      await writeFile(`${dir}/${code}.webp`, Buffer.from(bytes, 'base64'));
  }
} finally {
  await browser.close();
}

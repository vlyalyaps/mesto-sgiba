# Место сгиба

Дневник-скетчбук из фотографий, текста и песни. Записи собраны в книги по месяцам. На полях остаются вещи из рассказа, а главный снимок ложится на страницу в момент пика песни.

Проект для хакатона Genesis, трек ArtTech.

- Прототип: https://vlyalyaps.github.io/mesto-sgiba/
- Правила: [docs/rules.md](docs/rules.md)
- План, критерии и сдача: [docs/plan.md](docs/plan.md), скетчбук: [docs/sketchbook.md](docs/sketchbook.md)

## Запуск

Нужен Node 24.

```bash
npm install
npm run dev
```

Проверки: `npm test`, `npm run lint`, `npm run build`. Сквозные тесты: `npx playwright install chromium`, затем `npm run e2e`.

## Как устроено

Всё считается в браузере, сервера нет. Три входа (текст, фото, песня) превращаются в описание дня `DaySpec` ([src/types/dayspec.ts](src/types/dayspec.ts)), и книжка рисуется только из него.

```
src/input    ввод текста, фото и поиск песни
src/audio    разбор фрагмента: темп, энергия, пик
src/rules    правила: признаки дня → DaySpec
src/render   бумажные страницы и сборка на долях
src/weather  снимок погоды на час записи
src/archive  архив дней, экспорт и импорт ZIP
fixtures     контрольные дни для тестов
```

## Как работаем

Задачи — в Issues. Каждая задача — короткая ветка от `main` и PR. `main` всегда рабочий: после слияния GitHub Actions сам публикует сайт.

## Лицензия

Код — [MIT](LICENSE). Шрифты, музыка и прочие материалы — в [CREDITS.md](CREDITS.md).

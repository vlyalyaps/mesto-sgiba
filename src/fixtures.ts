import type { DayInput } from './types/dayspec';

/**
 * Три контрольных дня из fixtures/days. На них проверяются правила и отрисовка.
 * `expect` — то, что задумано в макете; правила могут это уточнить, но осознанно.
 */
export interface Fixture {
  file: string;
  /** Придуманный день со сгенерированными кадрами: нужен тестам, в приложении не показывается. */
  hidden?: boolean;
  about: string;
  input: DayInput;
  expect: Record<string, string>;
}

const files = import.meta.glob<Omit<Fixture, 'file'>>('../fixtures/days/*.json', {
  eager: true,
  import: 'default',
});

export const fixtures: Fixture[] = Object.entries(files)
  .map(([path, data]) => ({ file: path.split('/').pop() ?? path, ...data }))
  .sort((a, b) => a.input.number - b.input.number);

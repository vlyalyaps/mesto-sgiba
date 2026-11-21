import type { DaySpec } from '../../types/dayspec';

/** Ручную композицию показываем только для исходного контрольного дня. */
export function isReference047(spec: DaySpec) {
  return (
    spec.id === '2026-11-14-047' &&
    spec.folderName === 'Два стакана на чемодане' &&
    spec.photos.length === 2 &&
    spec.photos.some((p) => p.photoId === 'cups' && p.role === 'key') &&
    spec.photos.some((p) => p.photoId === 'perron' && p.role === 'support')
  );
}

export const referenceNotes = [
  'Оба стакана остаются в крупном кадре. На полях — след кружки и рисунок стакана в подстаканнике.',
  'Проездной билет и три фрагмента снимка перрона напоминают о поездке.',
  'Обведённое «Опоздали» и клубок линий на полях передают тревогу записи.',
  'У песни 2001 года свой корешок с долями и отметкой пика. На пике появляется большой полароид.',
];

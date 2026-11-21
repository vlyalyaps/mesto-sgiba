import type { DaySpec } from '../types/dayspec';
import { findCompany } from './text';

export function isReference047(spec: Pick<DaySpec, 'id' | 'folderName' | 'photos'>) {
  return (
    spec.id === '2026-11-14-047' &&
    spec.folderName === 'Два стакана на чемодане' &&
    spec.photos.length === 2 &&
    spec.photos.some((p) => p.photoId === 'cups' && p.role === 'key') &&
    spec.photos.some((p) => p.photoId === 'perron' && p.role === 'support')
  );
}

export function heartTrigger(text: string) {
  const company = findCompany(text);
  return (
    company.near.find((w) => w === 'рядом') ??
    company.we.find((w) => w === 'мы') ??
    company.names[0]
  );
}

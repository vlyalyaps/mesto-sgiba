import { objectsIn } from './objects';

type Hit = ReturnType<typeof objectsIn>[number];
const kinds: Record<string, string> = {
  train: 'rail-ticket',
  mountain: 'trail-map',
  cinema: 'cinema-ticket',
  bus: 'bus-pass',
  venue: 'entry-band',
  food: 'food-receipt',
  bread: 'food-receipt',
  cake: 'food-receipt',
  case: 'luggage-tag',
};

export function keepsakes(hits: Hit[]) {
  const seen = new Set<string>();
  return hits.flatMap((hit) => {
    const motif = kinds[hit.motif];
    if (!motif || seen.has(motif)) return [];
    seen.add(motif);
    return [{ motif, word: hit.word }];
  });
}

export const keepsakeNames: Record<string, string> = {
  'rail-ticket': 'железнодорожный билет',
  'trail-map': 'карта тропы',
  'cinema-ticket': 'билет в кино',
  'bus-pass': 'автобусный талон',
  'entry-band': 'браслет со входа',
  'food-receipt': 'чек',
  'luggage-tag': 'багажная бирка',
};

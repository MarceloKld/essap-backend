/** Nettoie les textes reçus avant validation (appliqué avec @Transform). */

/** Retire les espaces autour. */
export const nettoyer = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Comme nettoyer, mais un texte vide devient « absent » (un champ facultatif laissé vide dans un formulaire). */
export const nettoyerOptionnel = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const texte = value.trim();
  return texte === '' ? undefined : texte;
};

export const minusculesOptionnel = ({ value }: { value: unknown }): unknown => {
  const v = nettoyerOptionnel({ value });
  return typeof v === 'string' ? v.toLowerCase() : v;
};

export const majusculesOptionnel = ({ value }: { value: unknown }): unknown => {
  const v = nettoyerOptionnel({ value });
  return typeof v === 'string' ? v.toUpperCase() : v;
};
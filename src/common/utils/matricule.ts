export interface FormatMatricule {
  prefixe: string; // ex. « ES »
  longueurSequence: number; // ex. 2 -> « 01 »
}

/** Lit le format enregistré en base (JSON). Renvoie null s'il est absent ou invalide. */
export function lireFormatMatricule(valeur: unknown): FormatMatricule | null {
  const v = valeur as { prefixe?: unknown; longueurSequence?: unknown } | null;
  if (
    !v ||
    typeof v.prefixe !== 'string' ||
    !/^[A-Z]{2,10}$/.test(v.prefixe) ||
    typeof v.longueurSequence !== 'number' ||
    !Number.isInteger(v.longueurSequence) ||
    v.longueurSequence < 1 ||
    v.longueurSequence > 8
  ) {
    return null;
  }
  return { prefixe: v.prefixe, longueurSequence: v.longueurSequence };
}

/**
 * Assemble un matricule : préfixe + 2 derniers chiffres de l'année + classe + numéro.
 * Exemple : ('ES', '2026-2027', 'L1', 1, longueur 2) -> « ES26L101 ».
 */
export function formaterMatricule(format: FormatMatricule, libelleAnnee: string, codeClasse: string, numero: number): string {
  const annee = libelleAnnee.slice(2, 4);
  return `${format.prefixe}${annee}${codeClasse}${String(numero).padStart(format.longueurSequence, '0')}`;
}
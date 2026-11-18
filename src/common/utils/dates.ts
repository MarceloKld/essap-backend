/** Lit une date AAAA-MM-JJ. Renvoie null si elle n'existe pas dans le calendrier (ex. 2026-02-30). */
export function lireDateIso(texte: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) return null;
  const date = new Date(`${texte}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== texte) return null;
  return date;
}

/** Ancienne orthographe, gardée pour qu'aucun import ne casse. */
export const lireDateISO = lireDateIso;

/** Date -> « AAAA-MM-JJ » (format renvoyé par l'API). */
export const versTexteDate = (date: Date): string => date.toISOString().slice(0, 10);

/** Date -> « 15/11/2026 » (format des documents imprimés). */
export function formaterDateFr(date: Date): string {
  const jour = String(date.getUTCDate()).padStart(2, '0');
  const mois = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${jour}/${mois}/${date.getUTCFullYear()}`;
}
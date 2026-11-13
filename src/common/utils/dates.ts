/** Lit une date AAAA-MM-JJ. Renvoie null si elle n'existe pas dans le calendrier (ex. 2026-02-30). */
export function lireDateIso(texte: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) return null;
  const date = new Date(`${texte}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== texte) return null;
  return date;
}

/** Date -> « AAAA-MM-JJ » (format renvoyé par l'API). */
export const versTexteDate = (date: Date): string => date.toISOString().slice(0, 10);
/** Vrai si l'erreur est une violation de contrainte d'unicité (code Prisma P2002). */
export function estViolationUnicite(erreur: unknown): boolean {
  return typeof erreur === 'object' && erreur !== null && 'code' in erreur && (erreur as { code: unknown }).code === 'P2002';
}
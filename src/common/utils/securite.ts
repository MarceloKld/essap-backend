import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Jeton aléatoire imprévisible (384 bits), sans signification : c'est le refresh token. */
export function genererJetonOpaque(): string {
  return randomBytes(48).toString('base64url');
}

/**
 * Empreinte SHA-256 d'un jeton. On enregistre l'EMPREINTE en base, jamais le jeton :
 * si la base fuit, personne ne peut s'en servir pour ouvrir une session.
 */
export function empreinteJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

/** Comparaison en temps constant : le temps de calcul ne révèle pas où les textes diffèrent. */
export function egalEnTempsConstant(a: string, b: string): boolean {
  const tampA = Buffer.from(a);
  const tampB = Buffer.from(b);
  return tampA.length === tampB.length && timingSafeEqual(tampA, tampB);
}

/**
 * Verrouillage PROGRESSIF après des échecs de connexion :
 *   moins de 5 échecs : aucun verrou
 *   5 échecs : 15 min, 6 : 30 min, 7 : 1 h, 8 : 2 h ... plafonné à 24 h
 */
export function dureeVerrouillageMinutes(echecs: number): number {
  const SEUIL = 5;
  if (echecs < SEUIL) return 0;
  return Math.min(15 * 2 ** (echecs - SEUIL), 24 * 60);
}
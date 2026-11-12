import { argon2id, hash, verify } from 'argon2';

/**
 * Argon2id = le standard actuel pour hacher un mot de passe.
 * Il est VOLONTAIREMENT lent et gourmand en mémoire : un pirate qui volerait la base
 * ne pourrait tester que très peu de mots de passe par seconde.
 *
 * memoryCost 2**16 = 64 Mo par calcul (ta checklist demande >= 64 Mo).
 * Si ton serveur gratuit manque de RAM, on pourra descendre à 2**15 (32 Mo).
 */
const OPTIONS = { type: argon2id, memoryCost: 2 ** 16, timeCost: 3, parallelism: 1 } as const;

/** Transforme un mot de passe en empreinte (salée automatiquement). */
export function hacherMotDePasse(clair: string): Promise<string> {
  return hash(clair, OPTIONS);
}

/** Compare un mot de passe à une empreinte. Renvoie false (jamais d'erreur) si l'empreinte est invalide. */
export async function verifierMotDePasse(empreinte: string, clair: string): Promise<boolean> {
  try {
    return await verify(empreinte, clair);
  } catch {
    return false;
  }
}
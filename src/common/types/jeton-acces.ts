import type { Request } from 'express';

/** Les 5 rôles du logiciel (les mêmes codes que dans la table "roles"). */
export const CODES_ROLES = ['SUPER_ADMIN', 'DG', 'SGAC', 'ADMIN_BUDGET', 'ETUDIANT'] as const;
export type CodeRole = (typeof CODES_ROLES)[number];

/** Vérifie qu'un code lu en base est bien un rôle connu. */
export function versCodeRole(code: string): CodeRole {
  if ((CODES_ROLES as readonly string[]).includes(code)) return code as CodeRole;
  throw new Error(`Rôle inconnu en base : ${code}`);
}

/**
 * Contenu du jeton d'accès (JWT). ATTENTION : un JWT est SIGNÉ mais pas CHIFFRÉ,
 * donc on n'y met jamais de secret (ni mot de passe, ni date de naissance).
 */
export interface PayloadAcces {
  sub: string; // identifiant de l'utilisateur (ou de l'étudiant)
  type: 'PERSONNEL' | 'ETUDIANT';
  role: CodeRole;
  institutId: number | null; // institut de rattachement (SGAC, Admin Budget, étudiant)
  // Instituts auxquels la personne a accès :
  //   null       = tous (Super Admin)
  //   [1, 4]     = liste précise (DG)
  //   [2]        = son seul institut (SGAC, Admin Budget, étudiant)
  institutsAutorises: number[] | null;
}

/** Requête Express enrichie par notre guard avec l'utilisateur connecté. */
export type RequeteAuthentifiee = Request & { utilisateur: PayloadAcces };
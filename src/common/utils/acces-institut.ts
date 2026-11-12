import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PayloadAcces } from '../types/jeton-acces.js';

/** Vrai si la personne a le droit d'agir sur cet institut. Le Super Admin les a tous. */
export function aAccesInstitut(utilisateur: PayloadAcces, institutId: number): boolean {
  if (utilisateur.role === 'SUPER_ADMIN') return true;
  return utilisateur.institutsAutorises?.includes(institutId) ?? false;
}

export function verifierAccesInstitut(utilisateur: PayloadAcces, institutId: number): void {
  if (!aAccesInstitut(utilisateur, institutId)) throw new ForbiddenException('Accès refusé à cet institut.');
}

/**
 * LE cœur de l'isolation : détermine sur quel institut la requête agit.
 *
 * Règle d'or : on ne FAIT JAMAIS confiance à ce que le navigateur envoie.
 *  - rattaché à un seul institut (SGAC, Admin Budget, étudiant) : l'institut du JETON est imposé ;
 *  - DG / Super Admin : l'en-tête X-Institut-Id est une DEMANDE, vérifiée contre la liste du jeton.
 */
export function resoudreInstitut(utilisateur: PayloadAcces, entete: string | string[] | undefined): number {
  const brut = Array.isArray(entete) ? entete[0] : entete;
  const demande = brut !== undefined && brut.trim() !== '' ? Number(brut) : null;
  if (demande !== null && (!Number.isInteger(demande) || demande <= 0)) {
    throw new BadRequestException('En-tête X-Institut-Id invalide.');
  }

  if (utilisateur.institutId !== null) {
    if (demande !== null && demande !== utilisateur.institutId) {
      throw new ForbiddenException('Accès refusé à cet institut.');
    }
    return utilisateur.institutId;
  }

  if (demande === null) {
    if (utilisateur.role === 'DG' && utilisateur.institutsAutorises?.length === 1) {
      return utilisateur.institutsAutorises[0];
    }
    throw new BadRequestException("Précisez l'institut avec l'en-tête X-Institut-Id.");
  }
  verifierAccesInstitut(utilisateur, demande);
  return demande;
}
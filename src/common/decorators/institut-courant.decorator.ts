import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequeteAuthentifiee } from '../types/jeton-acces.js';
import { resoudreInstitut } from '../utils/acces-institut.js';

/**
 * Dans un contrôleur : (@InstitutCourant() institutId: number)
 * Renvoie l'institut sur lequel agir, DÉJÀ vérifié. Toute requête de données
 * (étudiants, paiements...) devra filtrer avec cette valeur : « where: { institutId } ».
 */
export const InstitutCourant = createParamDecorator((_donnees: unknown, contexte: ExecutionContext): number => {
  const requete = contexte.switchToHttp().getRequest<RequeteAuthentifiee>();
  return resoudreInstitut(requete.utilisateur, requete.headers['x-institut-id']);
});
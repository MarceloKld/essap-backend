import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PayloadAcces } from '../types/jeton-acces.js';

/** Récupère l'utilisateur connecté dans un contrôleur : (@UtilisateurCourant() u: PayloadAcces) */
export const UtilisateurCourant = createParamDecorator(
  (_donnees: unknown, contexte: ExecutionContext): PayloadAcces => {
    const requete = contexte.switchToHttp().getRequest<{ utilisateur: PayloadAcces }>();
    return requete.utilisateur;
  },
);
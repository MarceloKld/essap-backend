import type { CodeRole } from '../../common/types/jeton-acces.js';

export interface ContexteRequete {
  adresseIp: string | null;
  appareil: string | null;
}

export interface ProfilConnecte {
  id: string;
  type: 'PERSONNEL' | 'ETUDIANT';
  role: CodeRole;
  nomComplet: string;
  institutId: number | null;
  nomUtilisateur?: string;
  matricule?: string;
  email?: string | null;
  telephone?: string | null;
}

export interface ResultatSession {
  jetonAcces: string;
  expireDansSecondes: number;
  rafraichissement: string; // va dans le COOKIE, jamais dans le corps de la réponse
  rafraichissementExpireLe: Date;
  doitChangerMotDePasse: boolean;
  profil: ProfilConnecte;
}

export interface ProprietaireJeton {
  utilisateurId?: string;
  compteEtudiantId?: string;
}
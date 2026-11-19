import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { lireDateIso, versTexteDate } from '../../common/utils/dates.js';
import { normaliserTelephone } from '../../common/utils/identifiants.js';

// Champs d'un étudiant renvoyés par l'API : on choisit explicitement, jamais « tout ».
export const CHAMPS_ETUDIANT = {
  id: true, institutId: true, matricule: true, nom: true, postnom: true, prenom: true, sexe: true,
  dateNaissance: true, lieuNaissance: true, nationalite: true, etatCivil: true,
  telephone: true, email: true, adresse: true, contactUrgenceNom: true, contactUrgenceTelephone: true,
  dernierDiplome: true, anneeObtention: true, etablissementOrigine: true, villePaysOrigine: true,
  statut: true, estImporte: true, creeLe: true,
} satisfies Prisma.EtudiantSelect;
export type EtudiantLu = Prisma.EtudiantGetPayload<{ select: typeof CHAMPS_ETUDIANT }>;

export const nomComplet = (p: { nom: string; postnom: string | null; prenom: string | null }): string =>
  [p.nom, p.postnom, p.prenom].filter(Boolean).join(' ');

export function presenterEtudiant(e: EtudiantLu) {
  return { ...e, dateNaissance: versTexteDate(e.dateNaissance), nomComplet: nomComplet(e) };
}

/** Année visée : celle demandée, sinon l'année ACTIVE. Elle doit appartenir à l'institut et ne pas être clôturée. */
export async function resoudreAnnee(db: PrismaService, institutId: number, anneeId?: number) {
  const annee = await db.anneeScolaire.findFirst({
    where: anneeId ? { id: anneeId, institutId } : { institutId, estActive: true },
    select: { id: true, libelle: true, estCloturee: true },
  });
  if (!annee) {
    throw new NotFoundException(anneeId ? 'Année scolaire introuvable.' : "Aucune année scolaire active : activez-en une d'abord.");
  }
  if (annee.estCloturee) throw new ConflictException('Année scolaire clôturée : elle est en lecture seule.');
  return annee;
}

/**
 * Trouve la classe dans l'institut. Si plusieurs filières ont une classe de même code (L1 en Pharmacie
 * ET en Laboratoire), la filière doit être précisée.
 */
export async function resoudreClasse(db: PrismaService, institutId: number, classeCode: string, filiereCode?: string) {
  const classes = await db.classe.findMany({
    where: { institutId, code: classeCode, actif: true, filiere: { actif: true, ...(filiereCode ? { code: filiereCode } : {}) } },
    select: { id: true, code: true, ordre: true, filiereId: true, filiere: { select: { code: true, libelle: true } } },
  });
  if (classes.length === 0) {
    throw new BadRequestException(`Classe inconnue dans cet institut : ${classeCode}${filiereCode ? ` (filière ${filiereCode})` : ''}.`);
  }
  if (classes.length > 1) {
    throw new BadRequestException(
      `Plusieurs filières ont une classe ${classeCode} : précisez la filière avec « filiereCode » (${classes.map((c) => c.filiere.code).join(', ')}).`,
    );
  }
  return classes[0];
}

export function verifierNaissance(texte: string): Date {
  const date = lireDateIso(texte);
  if (!date) throw new BadRequestException('Date de naissance invalide (format AAAA-MM-JJ).');
  if (date > new Date()) throw new BadRequestException('La date de naissance ne peut pas être dans le futur.');
  if (date.getUTCFullYear() < 1940) throw new BadRequestException('Date de naissance trop ancienne.');
  return date;
}

export function verifierAnneeObtention(annee: number | undefined): void {
  if (annee !== undefined && annee > new Date().getUTCFullYear()) {
    throw new BadRequestException("L'année d'obtention ne peut pas être dans le futur.");
  }
}

export function telephoneOuErreur(valeur: string | undefined, libelle: string): string | null {
  if (valeur === undefined || valeur === '') return null;
  const tel = normaliserTelephone(valeur);
  if (!tel) throw new BadRequestException(`${libelle} invalide : ${valeur}`);
  return tel;
}
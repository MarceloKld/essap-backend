import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { ContexteRequete } from '../auth/auth.types.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { reponsePaginee } from '../../common/dto/pagination.dto.js';
import type { ChangerStatutDto } from './dto/changer-statut.dto.js';
import type { ListerEtudiantsDto } from './dto/lister-etudiants.dto.js';
import type { ModifierEtudiantDto } from './dto/modifier-etudiant.dto.js';
import { CHAMPS_ETUDIANT, presenterEtudiant, telephoneOuErreur, verifierNaissance } from './etudiants.commun.js';

/** Toute requête est filtrée par institutId : un étudiant d'un autre institut n'existe tout simplement pas. */
@Injectable()
export class EtudiantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // =====================================================================
  //  LISTE (pagination, recherche, filtres)
  // =====================================================================
  async lister(institutId: number, f: ListerEtudiantsDto) {
    const filtres: Prisma.EtudiantWhereInput[] = [];
    if (f.statut) filtres.push({ statut: f.statut });
    if (f.sexe) filtres.push({ sexe: f.sexe });
    if (f.anneeId || f.classeCode) {
      filtres.push({
        inscriptions: {
          some: {
            annuleeLe: null,
            ...(f.anneeId ? { anneeId: f.anneeId } : {}),
            ...(f.classeCode ? { classe: { code: f.classeCode } } : {}),
          },
        },
      });
    }
    if (f.q) {
      filtres.push({
        OR: [
          { nom: { contains: f.q, mode: 'insensitive' } },
          { postnom: { contains: f.q, mode: 'insensitive' } },
          { prenom: { contains: f.q, mode: 'insensitive' } },
          { matricule: { contains: f.q, mode: 'insensitive' } },
          { telephone: { contains: f.q } },
        ],
      });
    }
    const where: Prisma.EtudiantWhereInput = { institutId, supprimeLe: null, AND: filtres };

    const [total, lignes] = await this.prisma.$transaction([
      this.prisma.etudiant.count({ where }),
      this.prisma.etudiant.findMany({
        where,
        select: {
          ...CHAMPS_ETUDIANT,
          // Dernière inscription : classe et année « courantes » de l'étudiant
          inscriptions: {
            where: { annuleeLe: null },
            orderBy: { annee: { dateDebut: 'desc' } },
            take: 1,
            select: { type: true, decision: true, classe: { select: { code: true } }, annee: { select: { id: true, libelle: true } } },
          },
        },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        skip: (f.page - 1) * f.limite,
        take: f.limite,
      }),
    ]);

    const donnees = lignes.map(({ inscriptions, ...base }) => ({
      ...presenterEtudiant(base),
      inscriptionCourante: inscriptions[0]
        ? {
            type: inscriptions[0].type,
            decision: inscriptions[0].decision,
            classeCode: inscriptions[0].classe.code,
            anneeId: inscriptions[0].annee.id,
            anneeLibelle: inscriptions[0].annee.libelle,
          }
        : null,
    }));
    return reponsePaginee(donnees, total, f.page, f.limite);
  }

  // =====================================================================
  //  FICHE COMPLÈTE : identité, parcours année par année, compte étudiant
  // =====================================================================
  async detail(institutId: number, id: string) {
    const e = await this.prisma.etudiant.findFirst({
      where: { id, institutId, supprimeLe: null },
      select: {
        ...CHAMPS_ETUDIANT,
        inscriptions: {
          orderBy: { annee: { dateDebut: 'asc' } },
          select: {
            id: true, type: true, decision: true, annuleeLe: true, dateInscription: true,
            classe: { select: { code: true } }, annee: { select: { id: true, libelle: true } },
          },
        },
        statutsAnnuels: { orderBy: { annee: { dateDebut: 'asc' } }, select: { etat: true, annee: { select: { libelle: true } } } },
        compte: { select: { actif: true, verrouilleJusqua: true, tentativesEchouees: true, derniereConnexionLe: true } },
      },
    });
    if (!e) throw new NotFoundException('Étudiant introuvable.');

    const { inscriptions, statutsAnnuels, compte, ...base } = e;
    return {
      ...presenterEtudiant(base),
      inscriptions: inscriptions.map((i) => ({
        id: i.id, type: i.type, decision: i.decision, annulee: i.annuleeLe !== null, dateInscription: i.dateInscription,
        classeCode: i.classe.code, anneeId: i.annee.id, anneeLibelle: i.annee.libelle,
      })),
      statutsAnnuels: statutsAnnuels.map((s) => ({ anneeLibelle: s.annee.libelle, etat: s.etat })),
      compte,
    };
  }

  // =====================================================================
  //  MODIFICATION (le matricule n'est jamais modifiable)
  // =====================================================================
  async modifier(acteur: PayloadAcces, institutId: number, id: string, dto: ModifierEtudiantDto, ctx: ContexteRequete) {
    const avant = await this.prisma.etudiant.findFirst({ where: { id, institutId, supprimeLe: null }, select: CHAMPS_ETUDIANT });
    if (!avant) throw new NotFoundException('Étudiant introuvable.');

    const data: Prisma.EtudiantUpdateInput = {};
    if (dto.nom !== undefined) data.nom = dto.nom;
    if (dto.postnom !== undefined) data.postnom = dto.postnom;
    if (dto.prenom !== undefined) data.prenom = dto.prenom;
    if (dto.sexe !== undefined) data.sexe = dto.sexe;
    if (dto.dateNaissance !== undefined) data.dateNaissance = verifierNaissance(dto.dateNaissance);
    if (dto.lieuNaissance !== undefined) data.lieuNaissance = dto.lieuNaissance;
    if (dto.nationalite !== undefined) data.nationalite = dto.nationalite;
    if (dto.telephone !== undefined) data.telephone = telephoneOuErreur(dto.telephone, 'Téléphone');
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.adresse !== undefined) data.adresse = dto.adresse;
    if (dto.nomTuteur !== undefined) data.nomTuteur = dto.nomTuteur;
    if (dto.telephoneTuteur !== undefined) data.telephoneTuteur = telephoneOuErreur(dto.telephoneTuteur, 'Téléphone du tuteur');
    if (Object.keys(data).length === 0) throw new BadRequestException('Aucune modification fournie.');

    const apres = await this.prisma.etudiant.update({ where: { id }, data, select: CHAMPS_ETUDIANT });
    await this.audit.enregistrer({
      action: 'ETUDIANT_MODIFIE', utilisateurId: acteur.sub, institutId, entite: 'etudiants', entiteId: id,
      avant: presenterEtudiant(avant), apres: presenterEtudiant(apres), ...ctx,
    });
    return presenterEtudiant(apres);
  }

  // =====================================================================
  //  STATUT (suspendu, parti, diplômé...) avec motif obligatoire
  // =====================================================================
  async changerStatut(acteur: PayloadAcces, institutId: number, id: string, dto: ChangerStatutDto, ctx: ContexteRequete) {
    const avant = await this.prisma.etudiant.findFirst({ where: { id, institutId, supprimeLe: null }, select: { id: true, statut: true } });
    if (!avant) throw new NotFoundException('Étudiant introuvable.');

    const apres = await this.prisma.etudiant.update({ where: { id }, data: { statut: dto.statut }, select: CHAMPS_ETUDIANT });
    await this.audit.enregistrer({
      action: 'ETUDIANT_STATUT_MODIFIE', utilisateurId: acteur.sub, institutId, entite: 'etudiants', entiteId: id,
      details: { de: avant.statut, vers: dto.statut, motif: dto.motif }, ...ctx,
    });
    return presenterEtudiant(apres);
  }

  // =====================================================================
  //  COMPTE ÉTUDIANT : lever un verrouillage (après trop d'échecs de connexion)
  // =====================================================================
  async deverrouillerCompte(acteur: PayloadAcces, institutId: number, id: string, ctx: ContexteRequete) {
    const etudiant = await this.prisma.etudiant.findFirst({ where: { id, institutId, supprimeLe: null }, select: { id: true, compte: { select: { id: true } } } });
    if (!etudiant) throw new NotFoundException('Étudiant introuvable.');
    if (!etudiant.compte) throw new ConflictException("Cet étudiant n'a pas de compte (pas encore de matricule).");

    const compte = await this.prisma.compteEtudiant.update({
      where: { id: etudiant.compte.id },
      data: { tentativesEchouees: 0, verrouilleJusqua: null },
      select: { actif: true, verrouilleJusqua: true, tentativesEchouees: true },
    });
    await this.audit.enregistrer({
      action: 'COMPTE_ETUDIANT_DEVERROUILLE', utilisateurId: acteur.sub, institutId, entite: 'etudiants', entiteId: id, ...ctx,
    });
    return compte;
  }
}
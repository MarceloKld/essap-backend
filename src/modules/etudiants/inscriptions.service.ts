import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { ContexteRequete } from '../auth/auth.types.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { estViolationUnicite } from '../../common/utils/erreurs-prisma.js';
import type { AjouterExistantDto, InscrireEtudiantDto, MettreAJourPiecesDto, ReinscrireDto } from './dto/inscrire-etudiant.dto.js';
import {
  CHAMPS_ETUDIANT, nomComplet, presenterEtudiant, resoudreAnnee, resoudreClasse,
  telephoneOuErreur, verifierAnneeObtention, verifierNaissance,
} from './etudiants.commun.js';
import { MatriculeService } from './matricule.service.js';

type DonneesCreation = InscrireEtudiantDto & { matricule?: string };
type TypeCreation = 'INSCRIPTION' | 'IMPORTE';

@Injectable()
export class InscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly matricules: MatriculeService,
  ) {}

  /** Nouvel étudiant : fiche + matricule + inscription + statut de l'année + compte étudiant, en UNE transaction. */
  inscrire(acteur: PayloadAcces, institutId: number, dto: InscrireEtudiantDto, ctx: ContexteRequete) {
    return this.creer(acteur, institutId, dto, 'INSCRIPTION', ctx);
  }

  /** Étudiant déjà connu : même chose, marqué « importé » (les frais d'inscription ne s'appliquent pas). */
  ajouterExistant(acteur: PayloadAcces, institutId: number, dto: AjouterExistantDto, ctx: ContexteRequete) {
    return this.creer(acteur, institutId, dto, 'IMPORTE', ctx);
  }

  private async creer(acteur: PayloadAcces, institutId: number, dto: DonneesCreation, type: TypeCreation, ctx: ContexteRequete) {
    // 1) Vérifications AVANT d'écrire quoi que ce soit
    const naissance = verifierNaissance(dto.dateNaissance);
    verifierAnneeObtention(dto.anneeObtention);
    const telephone = telephoneOuErreur(dto.telephone, 'Téléphone');
    const telephoneUrgence = telephoneOuErreur(dto.contactUrgenceTelephone, "Téléphone du contact d'urgence");
    const annee = await resoudreAnnee(this.prisma, institutId, dto.anneeId);
    const classe = await resoudreClasse(this.prisma, institutId, dto.classeCode, dto.filiereCode);

    if (!dto.ignorerDoublon) {
      const doublon = await this.prisma.etudiant.findFirst({
        where: {
          institutId,
          supprimeLe: null,
          dateNaissance: naissance,
          nom: { equals: dto.nom, mode: 'insensitive' },
          postnom: dto.postnom ? { equals: dto.postnom, mode: 'insensitive' } : null,
          prenom: dto.prenom ? { equals: dto.prenom, mode: 'insensitive' } : null,
        },
        select: { id: true, matricule: true, nom: true, postnom: true, prenom: true, statut: true },
      });
      if (doublon) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: "Un étudiant avec la même identité existe déjà. Si c'est bien une autre personne, renvoyez avec « ignorerDoublon: true ».",
          doublon: { id: doublon.id, matricule: doublon.matricule, nomComplet: nomComplet(doublon), statut: doublon.statut },
        });
      }
    }
    if (dto.matricule) {
      const pris = await this.prisma.etudiant.findUnique({ where: { matricule: dto.matricule }, select: { id: true } });
      if (pris) throw new ConflictException('Ce matricule est déjà attribué.');
    }

    // 2) Écriture : tout réussit ou rien n'est créé
    try {
      const resultat = await this.prisma.$transaction(
        async (tx) => {
          const matricule = dto.matricule ?? (await this.matricules.suivant(tx, institutId, annee));
          const etudiant = await tx.etudiant.create({
            data: {
              institutId, matricule,
              nom: dto.nom, postnom: dto.postnom ?? null, prenom: dto.prenom ?? null,
              sexe: dto.sexe, dateNaissance: naissance,
              lieuNaissance: dto.lieuNaissance ?? null, nationalite: dto.nationalite ?? null,
              etatCivil: dto.etatCivil ?? null,
              telephone, email: dto.email ?? null, adresse: dto.adresse ?? null,
              contactUrgenceNom: dto.contactUrgenceNom ?? null, contactUrgenceTelephone: telephoneUrgence,
              dernierDiplome: dto.dernierDiplome ?? null, anneeObtention: dto.anneeObtention ?? null,
              etablissementOrigine: dto.etablissementOrigine ?? null, villePaysOrigine: dto.villePaysOrigine ?? null,
              statut: 'INSCRIT', estImporte: type === 'IMPORTE', creePar: acteur.sub,
            },
            select: CHAMPS_ETUDIANT,
          });
          const inscription = await tx.inscription.create({
            data: {
              etudiantId: etudiant.id, anneeId: annee.id, classeId: classe.id, institutId, type,
              piecesFournies: dto.piecesFournies ?? [], faitA: dto.faitA ?? null, creePar: acteur.sub,
            },
            select: { id: true, type: true, decision: true, piecesFournies: true, faitA: true },
          });
          await tx.statutAnnuel.create({ data: { etudiantId: etudiant.id, anneeId: annee.id, etat: 'INSCRIT' } });
          await tx.compteEtudiant.create({ data: { etudiantId: etudiant.id } }); // connexion : matricule + date de naissance
          return { etudiant, inscription };
        },
        { timeout: 15_000 },
      );

      await this.audit.enregistrer({
        action: type === 'IMPORTE' ? 'ETUDIANT_EXISTANT_AJOUTE' : 'ETUDIANT_INSCRIT',
        utilisateurId: acteur.sub, institutId, entite: 'etudiants', entiteId: resultat.etudiant.id,
        details: { matricule: resultat.etudiant.matricule, classe: classe.code, filiere: classe.filiere.code, annee: annee.libelle },
        ...ctx,
      });
      return {
        etudiant: presenterEtudiant(resultat.etudiant),
        inscription: {
          ...resultat.inscription, classeCode: classe.code, filiereCode: classe.filiere.code, anneeLibelle: annee.libelle,
        },
        compteCree: true,
      };
    } catch (erreur) {
      if (estViolationUnicite(erreur)) throw new ConflictException('Ce matricule est déjà attribué.');
      throw erreur;
    }
  }

  // =====================================================================
  //  RÉINSCRIPTION : l'étudiant GARDE son matricule
  // =====================================================================
  async reinscrire(acteur: PayloadAcces, institutId: number, etudiantId: string, dto: ReinscrireDto, ctx: ContexteRequete) {
    // Étudiant cherché DANS l'institut courant : un étudiant d'un autre institut = 404
    const etudiant = await this.prisma.etudiant.findFirst({
      where: { id: etudiantId, institutId, supprimeLe: null },
      select: {
        id: true, matricule: true, statut: true,
        inscriptions: {
          where: { annuleeLe: null },
          orderBy: { annee: { dateDebut: 'desc' } },
          take: 1,
          select: { classe: { select: { id: true, code: true, ordre: true, filiereId: true, filiere: { select: { code: true } } } } },
        },
      },
    });
    if (!etudiant) throw new NotFoundException('Étudiant introuvable.');
    if (!etudiant.matricule) throw new ConflictException("Cet étudiant n'a pas encore de matricule : sa demande doit d'abord être finalisée.");
    if (etudiant.statut === 'SUSPENDU') throw new ConflictException("Étudiant suspendu : levez d'abord la suspension (changement de statut).");

    const derniere = etudiant.inscriptions[0];
    if (!derniere) throw new BadRequestException("Aucune inscription précédente : utilisez l'inscription ou « étudiant existant ».");

    const classe = await this.classeSelonDecision(institutId, dto, derniere.classe);
    const annee = await resoudreAnnee(this.prisma, institutId, dto.anneeId);

    const dejaInscrit = await this.prisma.inscription.findUnique({
      where: { etudiantId_anneeId: { etudiantId, anneeId: annee.id } },
      select: { id: true },
    });
    if (dejaInscrit) throw new ConflictException('Cet étudiant est déjà inscrit pour cette année scolaire.');

    const inscription = await this.prisma.$transaction(async (tx) => {
      const cree = await tx.inscription.create({
        data: {
          etudiantId, anneeId: annee.id, classeId: classe.id, institutId, type: 'REINSCRIPTION', decision: dto.decision,
          piecesFournies: dto.piecesFournies ?? [], faitA: dto.faitA ?? null, creePar: acteur.sub,
        },
        select: { id: true, type: true, decision: true, piecesFournies: true, faitA: true },
      });
      await tx.statutAnnuel.upsert({
        where: { etudiantId_anneeId: { etudiantId, anneeId: annee.id } },
        create: { etudiantId, anneeId: annee.id, etat: 'INSCRIT' },
        update: { etat: 'INSCRIT' },
      });
      await tx.etudiant.update({ where: { id: etudiantId }, data: { statut: 'INSCRIT' } });
      return cree;
    });

    await this.audit.enregistrer({
      action: 'ETUDIANT_REINSCRIT', utilisateurId: acteur.sub, institutId, entite: 'etudiants', entiteId: etudiantId,
      details: { matricule: etudiant.matricule, decision: dto.decision, classe: classe.code, annee: annee.libelle },
      ...ctx,
    });
    return {
      etudiant: { id: etudiantId, matricule: etudiant.matricule },
      inscription: { ...inscription, classeCode: classe.code, anneeLibelle: annee.libelle },
    };
  }

  // =====================================================================
  //  PIÈCES REMISES (section 4 de la fiche)
  // =====================================================================
  async mettreAJourPieces(acteur: PayloadAcces, institutId: number, etudiantId: string, dto: MettreAJourPiecesDto, ctx: ContexteRequete) {
    const inscription = await this.prisma.inscription.findFirst({
      where: {
        etudiantId, institutId, annuleeLe: null,
        ...(dto.anneeId ? { anneeId: dto.anneeId } : { annee: { estActive: true } }),
      },
      select: { id: true, piecesFournies: true, faitA: true, annee: { select: { libelle: true, estCloturee: true } } },
    });
    if (!inscription) throw new NotFoundException("Aucune inscription trouvée pour cet étudiant dans cette année scolaire.");
    if (inscription.annee.estCloturee) throw new ConflictException('Année scolaire clôturée : elle est en lecture seule.');

    const apres = await this.prisma.inscription.update({
      where: { id: inscription.id },
      data: { piecesFournies: dto.piecesFournies, ...(dto.faitA !== undefined ? { faitA: dto.faitA } : {}) },
      select: { piecesFournies: true, faitA: true },
    });
    await this.audit.enregistrer({
      action: 'PIECES_MODIFIEES', utilisateurId: acteur.sub, institutId, entite: 'inscriptions', entiteId: inscription.id,
      avant: { piecesFournies: inscription.piecesFournies, faitA: inscription.faitA }, apres, ...ctx,
    });
    return { anneeLibelle: inscription.annee.libelle, ...apres };
  }

  /** PASSAGE = classe supérieure (même filière), REDOUBLEMENT = même classe, REPRISE = classe choisie par le SGAC. */
  private async classeSelonDecision(
    institutId: number,
    dto: ReinscrireDto,
    derniere: { id: number; code: string; ordre: number; filiereId: number; filiere: { code: string } },
  ): Promise<{ id: number; code: string }> {
    if (dto.decision === 'REPRISE') {
      if (!dto.classeCode) throw new BadRequestException('Pour une reprise, indiquez la classe (classeCode).');
      return resoudreClasse(this.prisma, institutId, dto.classeCode, dto.filiereCode ?? derniere.filiere.code);
    }

    let classe: { id: number; code: string } = derniere;
    if (dto.decision === 'PASSAGE') {
      const suivante = await this.prisma.classe.findFirst({
        where: { filiereId: derniere.filiereId, ordre: derniere.ordre + 1, actif: true },
        select: { id: true, code: true },
      });
      if (!suivante) throw new BadRequestException("Il n'y a pas de classe supérieure : l'étudiant est au dernier niveau.");
      classe = suivante;
    }
    if (dto.classeCode && dto.classeCode !== classe.code) {
      throw new BadRequestException(`Incohérent : ${dto.decision} mène à ${classe.code}, pas à ${dto.classeCode}.`);
    }
    return classe;
  }
}
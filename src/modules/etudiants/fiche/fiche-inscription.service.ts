import { Injectable, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import type { ContexteRequete } from '../../auth/auth.types.js';
import type { PayloadAcces } from '../../../common/types/jeton-acces.js';
import { formaterDateFr } from '../../../common/utils/dates.js';
import { CHAMPS_ETUDIANT } from '../etudiants.commun.js';
import { afficherTelephone, genererPdf, type DonneesFiche } from './fiche-inscription.pdf.js';

const CHAMPS_INSTITUT_FICHE = {
  nom: true, sigle: true, adresse: true, telephone: true, telephone2: true, logoUrl: true,
} satisfies Prisma.InstitutSelect;

export interface FichePdf {
  pdf: Buffer;
  nomFichier: string;
}

/** Fabrique la fiche d'inscription en PDF (à la volée : jamais stockée sur le serveur). */
@Injectable()
export class FicheInscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Fiche REMPLIE d'un étudiant (dernière inscription, ou l'année demandée). */
  async remplie(acteur: PayloadAcces, institutId: number, etudiantId: string, anneeId: number | undefined, ctx: ContexteRequete): Promise<FichePdf> {
    const e = await this.prisma.etudiant.findFirst({
      where: { id: etudiantId, institutId, supprimeLe: null },
      select: {
        ...CHAMPS_ETUDIANT,
        institut: { select: CHAMPS_INSTITUT_FICHE },
        inscriptions: {
          where: { annuleeLe: null, ...(anneeId ? { anneeId } : {}) },
          orderBy: { annee: { dateDebut: 'desc' } },
          take: 1,
          select: {
            type: true, piecesFournies: true, faitA: true, dateInscription: true,
            classe: { select: { code: true, filiere: { select: { libelle: true } } } },
            annee: { select: { libelle: true } },
          },
        },
      },
    });
    if (!e) throw new NotFoundException('Étudiant introuvable.');
    const inscription = e.inscriptions[0];
    if (!inscription) throw new NotFoundException("Aucune inscription trouvée pour cet étudiant dans cette année scolaire.");

    const donnees: DonneesFiche = {
      institut: {
        nom: e.institut.nom, sigle: e.institut.sigle, adresse: e.institut.adresse,
        telephone: e.institut.telephone, telephone2: e.institut.telephone2,
      },
      logo: await this.chargerImage(e.institut.logoUrl),
      anneeLibelle: inscription.annee.libelle,
      filiereLibelle: inscription.classe.filiere.libelle,
      classeCode: inscription.classe.code,
      classesProposees: [],
      matricule: e.matricule,
      typeDemande: inscription.type,
      piecesFournies: inscription.piecesFournies,
      faitA: inscription.faitA,
      dateFiche: formaterDateFr(inscription.dateInscription),
      candidat: {
        nom: e.nom, postnom: e.postnom, prenom: e.prenom, sexe: e.sexe,
        dateNaissance: formaterDateFr(e.dateNaissance), lieuNaissance: e.lieuNaissance, nationalite: e.nationalite,
        etatCivil: e.etatCivil, telephone: afficherTelephone(e.telephone), email: e.email, adresse: e.adresse,
        contactUrgence: [e.contactUrgenceNom, afficherTelephone(e.contactUrgenceTelephone)].filter(Boolean).join(' - ') || null,
        dernierDiplome: e.dernierDiplome, anneeObtention: e.anneeObtention !== null ? String(e.anneeObtention) : null,
        etablissementOrigine: e.etablissementOrigine, villePaysOrigine: e.villePaysOrigine,
      },
    };

    const pdf = await genererPdf(donnees);
    await this.audit.enregistrer({
      action: 'FICHE_INSCRIPTION_GENEREE', utilisateurId: acteur.sub, institutId, entite: 'etudiants', entiteId: etudiantId,
      details: { matricule: e.matricule, annee: inscription.annee.libelle }, ...ctx,
    });
    return { pdf, nomFichier: `fiche-inscription-${e.matricule ?? 'sans-matricule'}.pdf` };
  }

  /** Fiche VIERGE à imprimer et remettre aux candidats. */
  async vierge(institutId: number, filiereCode: string | undefined, anneeId: number | undefined): Promise<FichePdf> {
    const institut = await this.prisma.institut.findFirst({ where: { id: institutId, supprimeLe: null }, select: CHAMPS_INSTITUT_FICHE });
    if (!institut) throw new NotFoundException('Institut introuvable.');

    const annee = await this.prisma.anneeScolaire.findFirst({
      where: anneeId ? { id: anneeId, institutId } : { institutId, estActive: true },
      select: { libelle: true },
    });
    if (!annee) throw new NotFoundException(anneeId ? 'Année scolaire introuvable.' : "Aucune année scolaire active.");

    const selectionFiliere = {
      libelle: true,
      classes: { where: { actif: true }, orderBy: { ordre: 'asc' }, select: { code: true } },
    } satisfies Prisma.FiliereSelect;

    let filiere: { libelle: string; classes: Array<{ code: string }> } | null = null;
    if (filiereCode) {
      filiere = await this.prisma.filiere.findFirst({ where: { institutId, code: filiereCode, actif: true }, select: selectionFiliere });
      if (!filiere) throw new NotFoundException(`Filière introuvable : ${filiereCode}`);
    } else {
      // Sans précision : la filière est imprimée seulement s'il n'y en a qu'une dans l'institut.
      const filieres = await this.prisma.filiere.findMany({ where: { institutId, actif: true }, take: 2, select: selectionFiliere });
      if (filieres.length === 1) filiere = filieres[0];
    }

    const pdf = await genererPdf({
      institut: {
        nom: institut.nom, sigle: institut.sigle, adresse: institut.adresse,
        telephone: institut.telephone, telephone2: institut.telephone2,
      },
      logo: await this.chargerImage(institut.logoUrl),
      anneeLibelle: annee.libelle,
      filiereLibelle: filiere?.libelle ?? null,
      classeCode: null,
      classesProposees: filiere?.classes.map((c) => c.code) ?? [],
      matricule: null,
      typeDemande: null,
      piecesFournies: [],
      faitA: null,
      dateFiche: null,
      candidat: null,
    });
    return { pdf, nomFichier: `fiche-inscription-vierge-${annee.libelle}.pdf` };
  }

  /**
   * Télécharge le logo (adresse https enregistrée par nous) et le convertit en PNG :
   * pdfkit ne lit que PNG et JPEG, alors que nos logos sont en WebP. Aucun logo = PDF sans logo.
   */
  private async chargerImage(url: string | null): Promise<Buffer | null> {
    if (!url || !url.startsWith('https://')) return null;
    try {
      const reponse = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!reponse.ok) return null;
      const source = Buffer.from(await reponse.arrayBuffer());
      if (source.length === 0 || source.length > 3_000_000) return null;
      return await sharp(source, { limitInputPixels: 25_000_000 }).png().toBuffer();
    } catch {
      return null;
    }
  }
}
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { ContexteRequete } from '../auth/auth.types.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { lireDateISO, versTexteDate } from '../../common/utils/dates.js';
import { estViolationUnicite } from '../../common/utils/erreurs-prisma.js';
import type { CreerAnneeDto } from './dto/creer-annee.dto.js';

const CHAMPS_ANNEE = {
  id: true, libelle: true, dateDebut: true, dateFin: true, estActive: true, estCloturee: true, clotureLe: true,
} satisfies Prisma.AnneeScolaireSelect;
type AnneeLue = Prisma.AnneeScolaireGetPayload<{ select: typeof CHAMPS_ANNEE }>;

const presenter = (a: AnneeLue) => ({
  ...a,
  dateDebut: versTexteDate(a.dateDebut),
  dateFin: versTexteDate(a.dateFin),
});

/**
 * Toutes les requêtes filtrent par institutId : une année appartient à UN institut.
 * Clôturer l'année d'un institut ne touche jamais celle d'un autre.
 */
@Injectable()
export class AnneesScolairesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async creer(acteur: PayloadAcces, institutId: number, dto: CreerAnneeDto, ctx: ContexteRequete) {
    const debut = lireDateISO(dto.dateDebut);
    const fin = lireDateISO(dto.dateFin);
    if (!debut || !fin) throw new BadRequestException('Date invalide.');
    if (fin <= debut) throw new BadRequestException('La date de fin doit être après la date de début.');

    const [premiere, seconde] = dto.libelle.split('-').map(Number);
    if (seconde !== premiere + 1) {
      throw new BadRequestException('Le libellé doit contenir deux années consécutives (ex. 2026-2027).');
    }

    try {
      const annee = await this.prisma.anneeScolaire.create({
        data: { institutId, libelle: dto.libelle, dateDebut: debut, dateFin: fin }, // créée inactive : on l'active ensuite
        select: CHAMPS_ANNEE,
      });
      await this.audit.enregistrer({
        action: 'ANNEE_CREEE', utilisateurId: acteur.sub, institutId,
        entite: 'annees_scolaires', entiteId: String(annee.id), details: { libelle: dto.libelle }, ...ctx,
      });
      return presenter(annee);
    } catch (erreur) {
      if (estViolationUnicite(erreur)) throw new ConflictException('Cette année scolaire existe déjà pour cet institut.');
      throw erreur;
    }
  }

  async lister(institutId: number) {
    const annees = await this.prisma.anneeScolaire.findMany({
      where: { institutId },
      orderBy: { libelle: 'desc' },
      select: CHAMPS_ANNEE,
    });
    return annees.map(presenter);
  }

  async active(institutId: number) {
    const annee = await this.prisma.anneeScolaire.findFirst({
      where: { institutId, estActive: true },
      select: CHAMPS_ANNEE,
    });
    if (!annee) throw new NotFoundException('Aucune année scolaire active.');
    return presenter(annee);
  }

  async activer(acteur: PayloadAcces, institutId: number, id: number, ctx: ContexteRequete) {
    const annee = await this.prisma.anneeScolaire.findFirst({ where: { id, institutId }, select: { id: true, estCloturee: true } });
    if (!annee) throw new NotFoundException('Année scolaire introuvable.');
    if (annee.estCloturee) throw new ConflictException('Une année clôturée ne peut pas être réactivée.');

    // Une seule transaction : on désactive les autres, puis on active celle-ci.
    // (L'index unique partiel de la base refuserait de toute façon deux années actives.)
    const [, maj] = await this.prisma.$transaction([
      this.prisma.anneeScolaire.updateMany({ where: { institutId, estActive: true, NOT: { id } }, data: { estActive: false } }),
      this.prisma.anneeScolaire.update({ where: { id }, data: { estActive: true }, select: CHAMPS_ANNEE }),
    ]);
    await this.audit.enregistrer({
      action: 'ANNEE_ACTIVEE', utilisateurId: acteur.sub, institutId,
      entite: 'annees_scolaires', entiteId: String(id), details: { libelle: maj.libelle }, ...ctx,
    });
    return presenter(maj);
  }

  async cloturer(acteur: PayloadAcces, institutId: number, id: number, ctx: ContexteRequete) {
    const annee = await this.prisma.anneeScolaire.findFirst({ where: { id, institutId }, select: { id: true, estCloturee: true } });
    if (!annee) throw new NotFoundException('Année scolaire introuvable.');
    if (annee.estCloturee) throw new ConflictException('Cette année est déjà clôturée.');

    const maj = await this.prisma.anneeScolaire.update({
      where: { id },
      data: { estCloturee: true, estActive: false, clotureLe: new Date() },
      select: CHAMPS_ANNEE,
    });
    await this.audit.enregistrer({
      action: 'ANNEE_CLOTUREE', utilisateurId: acteur.sub, institutId,
      entite: 'annees_scolaires', entiteId: String(id), details: { libelle: maj.libelle }, ...ctx,
    });
    return presenter(maj);
  }
}
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { ContexteRequete } from '../auth/auth.types.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { lireDateIso, versTexteDate } from '../../common/utils/dates.js';
import { estViolationUnicite } from '../../common/utils/erreurs-prisma.js';
import type { CreerAnneeDto } from './dto/creer-annee.dto.js';

const CHAMPS_ANNEE = {
  id: true, libelle: true, dateDebut: true, dateFin: true, estActive: true, estCloturee: true, clotureLe: true, creeLe: true,
} satisfies Prisma.AnneeScolaireSelect;
type AnneeLue = Prisma.AnneeScolaireGetPayload<{ select: typeof CHAMPS_ANNEE }>;

const presenter = (a: AnneeLue) => ({ ...a, dateDebut: versTexteDate(a.dateDebut), dateFin: versTexteDate(a.dateFin) });

/**
 * L'année scolaire est PROPRE À CHAQUE INSTITUT : on filtre toujours par institutId
 * (celui que l'isolation a résolu), jamais par une valeur envoyée par le navigateur.
 */
@Injectable()
export class AnneesScolairesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async lister(institutId: number) {
    const lignes = await this.prisma.anneeScolaire.findMany({
      where: { institutId },
      select: { ...CHAMPS_ANNEE, _count: { select: { inscriptions: true } } },
      orderBy: { dateDebut: 'desc' },
    });
    return lignes.map(({ _count, ...annee }) => ({ ...presenter(annee), nombreInscriptions: _count.inscriptions }));
  }

  async active(institutId: number) {
    const annee = await this.prisma.anneeScolaire.findFirst({ where: { institutId, estActive: true }, select: CHAMPS_ANNEE });
    if (!annee) throw new NotFoundException("Aucune année scolaire active : activez-en une d'abord.");
    return presenter(annee);
  }

  async creer(acteur: PayloadAcces, institutId: number, dto: CreerAnneeDto, ctx: ContexteRequete) {
    const debut = lireDateIso(dto.dateDebut);
    const fin = lireDateIso(dto.dateFin);
    if (!debut || !fin) throw new BadRequestException('Dates invalides.');
    if (fin <= debut) throw new BadRequestException('La date de fin doit être après la date de début.');
    const [premiere, seconde] = dto.libelle.split('-').map(Number);
    if (seconde !== premiere + 1) throw new BadRequestException('Le libellé doit être de la forme 2026-2027 (deux années consécutives).');

    try {
      const cree = await this.prisma.$transaction(async (tx) => {
        // On désactive l'ancienne AVANT d'activer la nouvelle : l'index de la base n'autorise qu'une année active.
        if (dto.activer) await tx.anneeScolaire.updateMany({ where: { institutId, estActive: true }, data: { estActive: false } });
        return tx.anneeScolaire.create({
          data: { institutId, libelle: dto.libelle, dateDebut: debut, dateFin: fin, estActive: dto.activer === true },
          select: CHAMPS_ANNEE,
        });
      });
      await this.audit.enregistrer({
        action: 'ANNEE_CREEE', utilisateurId: acteur.sub, institutId, entite: 'annees_scolaires', entiteId: String(cree.id),
        details: { libelle: dto.libelle, active: cree.estActive }, ...ctx,
      });
      return presenter(cree);
    } catch (erreur) {
      if (estViolationUnicite(erreur)) throw new ConflictException('Une année scolaire avec ce libellé existe déjà pour cet institut.');
      throw erreur;
    }
  }

  async activer(acteur: PayloadAcces, institutId: number, id: number, ctx: ContexteRequete) {
    const annee = await this.charger(institutId, id);
    if (annee.estCloturee) throw new ConflictException('Une année clôturée ne peut pas être réactivée.');
    const maj = await this.prisma.$transaction(async (tx) => {
      await tx.anneeScolaire.updateMany({ where: { institutId, estActive: true }, data: { estActive: false } });
      return tx.anneeScolaire.update({ where: { id }, data: { estActive: true }, select: CHAMPS_ANNEE });
    });
    await this.audit.enregistrer({
      action: 'ANNEE_ACTIVEE', utilisateurId: acteur.sub, institutId, entite: 'annees_scolaires', entiteId: String(id), ...ctx,
    });
    return presenter(maj);
  }

  /** Clôturer = lecture seule définitive (on ne peut plus y inscrire). */
  async cloturer(acteur: PayloadAcces, institutId: number, id: number, ctx: ContexteRequete) {
    const annee = await this.charger(institutId, id);
    if (annee.estCloturee) return presenter(annee);
    const maj = await this.prisma.anneeScolaire.update({
      where: { id },
      data: { estCloturee: true, clotureLe: new Date(), estActive: false },
      select: CHAMPS_ANNEE,
    });
    await this.audit.enregistrer({
      action: 'ANNEE_CLOTUREE', utilisateurId: acteur.sub, institutId, entite: 'annees_scolaires', entiteId: String(id), ...ctx,
    });
    return presenter(maj);
  }

  private async charger(institutId: number, id: number): Promise<AnneeLue> {
    const annee = await this.prisma.anneeScolaire.findFirst({ where: { id, institutId }, select: CHAMPS_ANNEE });
    if (!annee) throw new NotFoundException('Année scolaire introuvable.');
    return annee;
  }
}
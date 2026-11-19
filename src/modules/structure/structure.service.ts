import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { ContexteRequete } from '../auth/auth.types.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { estViolationUnicite } from '../../common/utils/erreurs-prisma.js';
import type { CreerClasseDto, CreerDomaineDto, CreerFiliereDto, InitialiserStructureDto } from './dto/structure.dto.js';

const NIVEAUX = [
  { code: 'L1', libelle: 'Licence 1' },
  { code: 'L2', libelle: 'Licence 2' },
  { code: 'L3', libelle: 'Licence 3' },
  { code: 'M1', libelle: 'Master 1' },
  { code: 'M2', libelle: 'Master 2' },
];

const CHAMPS_DOMAINE = { id: true, code: true, libelle: true, actif: true } as const;
const CHAMPS_CLASSE = { id: true, code: true, libelle: true, ordre: true, actif: true } as const;

/** Toutes les opérations agissent sur l'institut COURANT (résolu et vérifié par @InstitutCourant). */
@Injectable()
export class StructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Arbre complet : domaines -> filières -> classes. */
  async arbre(institutId: number) {
    const domaines = await this.prisma.domaine.findMany({
      where: { institutId },
      orderBy: { id: 'asc' },
      select: {
        ...CHAMPS_DOMAINE,
        filieres: {
          orderBy: { id: 'asc' },
          select: {
            id: true, code: true, libelle: true, actif: true,
            classes: { orderBy: { ordre: 'asc' }, select: CHAMPS_CLASSE },
          },
        },
      },
    });
    return { domaines };
  }

  /** Liste à plat des classes (avec leur filière). */
  classes(institutId: number, filiereCode?: string) {
    return this.prisma.classe.findMany({
      where: { institutId, ...(filiereCode ? { filiere: { code: filiereCode } } : {}) },
      select: { ...CHAMPS_CLASSE, filiere: { select: { code: true, libelle: true } } },
      orderBy: [{ filiereId: 'asc' }, { ordre: 'asc' }],
    });
  }

  async creerDomaine(acteur: PayloadAcces, institutId: number, dto: CreerDomaineDto, ctx: ContexteRequete) {
    await this.verifierInstitut(institutId);
    try {
      const domaine = await this.prisma.domaine.create({
        data: { institutId, code: dto.code, libelle: dto.libelle },
        select: CHAMPS_DOMAINE,
      });
      await this.journaliser(acteur, institutId, 'DOMAINE_CREE', 'domaines', domaine.id, { code: dto.code }, ctx);
      return domaine;
    } catch (erreur) {
      if (estViolationUnicite(erreur)) throw new ConflictException('Ce code de domaine existe déjà dans cet institut.');
      throw erreur;
    }
  }

  async creerFiliere(acteur: PayloadAcces, institutId: number, dto: CreerFiliereDto, ctx: ContexteRequete) {
    await this.verifierInstitut(institutId);
    const domaine = await this.prisma.domaine.findUnique({
      where: { institutId_code: { institutId, code: dto.domaineCode } },
      select: { id: true },
    });
    if (!domaine) throw new NotFoundException(`Domaine introuvable : ${dto.domaineCode}`);
    try {
      const filiere = await this.prisma.filiere.create({
        data: { institutId, domaineId: domaine.id, code: dto.code, libelle: dto.libelle },
        select: { id: true, code: true, libelle: true, actif: true },
      });
      await this.journaliser(acteur, institutId, 'FILIERE_CREEE', 'filieres', filiere.id, { code: dto.code }, ctx);
      return { ...filiere, domaineCode: dto.domaineCode };
    } catch (erreur) {
      if (estViolationUnicite(erreur)) throw new ConflictException('Ce code de filière existe déjà dans cet institut.');
      throw erreur;
    }
  }

  async creerClasse(acteur: PayloadAcces, institutId: number, dto: CreerClasseDto, ctx: ContexteRequete) {
    await this.verifierInstitut(institutId);
    const filiere = await this.prisma.filiere.findUnique({
      where: { institutId_code: { institutId, code: dto.filiereCode } },
      select: { id: true },
    });
    if (!filiere) throw new NotFoundException(`Filière introuvable : ${dto.filiereCode}`);

    // Ordre par défaut : à la suite des classes existantes (M1 vient après L3).
    const max = await this.prisma.classe.aggregate({ where: { filiereId: filiere.id }, _max: { ordre: true } });
    const ordre = dto.ordre ?? (max._max.ordre ?? 0) + 1;
    try {
      const classe = await this.prisma.classe.create({
        data: { institutId, filiereId: filiere.id, code: dto.code, libelle: dto.libelle, ordre },
        select: CHAMPS_CLASSE,
      });
      await this.journaliser(acteur, institutId, 'CLASSE_CREEE', 'classes', classe.id, { code: dto.code, filiere: dto.filiereCode }, ctx);
      return { ...classe, filiereCode: dto.filiereCode };
    } catch (erreur) {
      if (estViolationUnicite(erreur)) throw new ConflictException('Cette classe existe déjà dans cette filière.');
      throw erreur;
    }
  }

  /** Démarrage rapide : domaine + filière + L1, L2, L3 (et M1, M2 si demandé), en UNE transaction. */
  async initialiser(acteur: PayloadAcces, institutId: number, dto: InitialiserStructureDto, ctx: ContexteRequete) {
    await this.verifierInstitut(institutId);
    const niveaux = dto.avecMaster ? NIVEAUX : NIVEAUX.slice(0, 3);
    try {
      const resultat = await this.prisma.$transaction(async (tx) => {
        const domaine = await tx.domaine.create({
          data: { institutId, code: dto.domaineCode, libelle: dto.domaineLibelle },
          select: CHAMPS_DOMAINE,
        });
        const filiere = await tx.filiere.create({
          data: { institutId, domaineId: domaine.id, code: dto.filiereCode, libelle: dto.filiereLibelle },
          select: { id: true, code: true, libelle: true, actif: true },
        });
        const classes = [];
        for (const [index, niveau] of niveaux.entries()) {
          classes.push(
            await tx.classe.create({
              data: { institutId, filiereId: filiere.id, code: niveau.code, libelle: niveau.libelle, ordre: index + 1 },
              select: CHAMPS_CLASSE,
            }),
          );
        }
        return { domaine, filiere, classes };
      });
      await this.journaliser(acteur, institutId, 'STRUCTURE_INITIALISEE', 'filieres', resultat.filiere.id, { classes: niveaux.length }, ctx);
      return resultat;
    } catch (erreur) {
      if (estViolationUnicite(erreur)) throw new ConflictException('Ce domaine ou cette filière existe déjà dans cet institut.');
      throw erreur;
    }
  }

  // --------------------------------------------------------------- outils privés
  /** Le Super Admin peut passer n'importe quel numéro : on vérifie que l'institut existe vraiment. */
  private async verifierInstitut(institutId: number): Promise<void> {
    const institut = await this.prisma.institut.findFirst({ where: { id: institutId, supprimeLe: null }, select: { id: true } });
    if (!institut) throw new NotFoundException('Institut introuvable.');
  }

  private journaliser(
    acteur: PayloadAcces, institutId: number, action: string, entite: string, entiteId: number,
    details: Record<string, string | number>, ctx: ContexteRequete,
  ) {
    return this.audit.enregistrer({
      action, utilisateurId: acteur.sub, institutId, entite, entiteId: String(entiteId), details, ...ctx,
    });
  }
}
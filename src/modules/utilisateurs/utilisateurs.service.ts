import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { ContexteRequete } from '../auth/auth.types.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { reponsePaginee } from '../../common/dto/pagination.dto.js';
import { estViolationUnicite } from '../../common/utils/erreurs-prisma.js';
import { normaliserTelephone } from '../../common/utils/identifiants.js';
import { hacherMotDePasse } from '../../common/utils/mot-de-passe.js';
import { genererMotDePasseTemporaire } from '../../common/utils/mot-de-passe-temporaire.js';
import { baseNomUtilisateur } from '../../common/utils/nom-utilisateur.js';
import type { CreerUtilisateurDto } from './dto/creer-utilisateur.dto.js';
import type { ListerUtilisateursDto } from './dto/lister-utilisateurs.dto.js';
import type { ModifierUtilisateurDto } from './dto/modifier-utilisateur.dto.js';

// On choisit explicitement les champs renvoyés : le mot de passe haché n'y est JAMAIS.
const CHAMPS_UTILISATEUR = {
  id: true, institutId: true, nomUtilisateur: true, nom: true, postnom: true, prenom: true,
  email: true, telephone: true, actif: true, doitChangerMotDePasse: true,
  verrouilleJusqua: true, derniereConnexionLe: true, creeLe: true,
  role: { select: { code: true } },
} satisfies Prisma.UtilisateurSelect;
type UtilisateurLu = Prisma.UtilisateurGetPayload<{ select: typeof CHAMPS_UTILISATEUR }>;

const presenter = ({ role, ...reste }: UtilisateurLu) => ({
  ...reste,
  nomComplet: [reste.nom, reste.postnom, reste.prenom].filter(Boolean).join(' '),
  role: role.code,
});

/** « Appartient à cet institut » : rattaché directement (SGAC, Budget) OU DG ayant accès à l'institut. */
const dansInstitut = (institutId: number): Prisma.UtilisateurWhereInput => ({
  OR: [{ institutId }, { accesInstituts: { some: { institutId } } }],
});

@Injectable()
export class UtilisateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // =====================================================================
  //  LISTE ET DÉTAIL (limités à l'institut courant)
  // =====================================================================
  async lister(institutId: number, p: ListerUtilisateursDto) {
    const filtres: Prisma.UtilisateurWhereInput[] = [dansInstitut(institutId)];
    if (p.role) filtres.push({ role: { code: p.role } });
    if (p.q) {
      filtres.push({
        OR: [
          { nom: { contains: p.q, mode: 'insensitive' } },
          { postnom: { contains: p.q, mode: 'insensitive' } },
          { prenom: { contains: p.q, mode: 'insensitive' } },
          { nomUtilisateur: { contains: p.q, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.UtilisateurWhereInput = { supprimeLe: null, AND: filtres };
    const [total, lignes] = await this.prisma.$transaction([
      this.prisma.utilisateur.count({ where }),
      this.prisma.utilisateur.findMany({
        where,
        select: CHAMPS_UTILISATEUR,
        orderBy: { creeLe: 'asc' },
        skip: (p.page - 1) * p.limite,
        take: p.limite,
      }),
    ]);
    return reponsePaginee(lignes.map(presenter), total, p.page, p.limite);
  }

  async detail(institutId: number, id: string) {
    return presenter(await this.chargerCible(institutId, id));
  }

  // =====================================================================
  //  CRÉATION
  // =====================================================================
  async creer(acteur: PayloadAcces, institutId: number, dto: CreerUtilisateurDto, ctx: ContexteRequete) {
    if (dto.role === 'DG' && acteur.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Seul le Super Admin peut créer un DG.');
    }
    const institut = await this.prisma.institut.findFirst({ where: { id: institutId, supprimeLe: null }, select: { id: true } });
    if (!institut) throw new NotFoundException('Institut introuvable.');

    const telephone = dto.telephone ? normaliserTelephone(dto.telephone) : null;
    if (dto.telephone && !telephone) throw new BadRequestException('Numéro de téléphone invalide.');

    await this.verifierDisponibilite({ telephone, email: dto.email, nomUtilisateur: dto.nomUtilisateur });

    const role = await this.prisma.role.findUnique({ where: { code: dto.role }, select: { id: true } });
    if (!role) throw new BadRequestException('Rôle absent de la base.');

    const nomUtilisateur = dto.nomUtilisateur ?? (await this.genererNomUtilisateur(dto.prenom, dto.nom));
    const motDePasseTemporaire = genererMotDePasseTemporaire();
    const motDePasseHache = await hacherMotDePasse(motDePasseTemporaire);

    try {
      const cree = await this.prisma.utilisateur.create({
        data: {
          nomUtilisateur,
          email: dto.email ?? null,
          telephone,
          motDePasseHache,
          nom: dto.nom,
          postnom: dto.postnom ?? null,
          prenom: dto.prenom ?? null,
          roleId: role.id,
          institutId: dto.role === 'DG' ? null : institutId, // un DG n'est rattaché à aucun institut précis...
          ...(dto.role === 'DG' ? { accesInstituts: { create: { institutId } } } : {}), // ...mais y a accès
          doitChangerMotDePasse: true, // modale de 1re connexion
          creePar: acteur.sub,
        },
        select: CHAMPS_UTILISATEUR,
      });
      await this.audit.enregistrer({
        action: 'UTILISATEUR_CREE',
        utilisateurId: acteur.sub,
        institutId,
        entite: 'utilisateurs',
        entiteId: cree.id,
        details: { role: dto.role },
        ...ctx,
      });
      return {
        utilisateur: presenter(cree),
        motDePasseTemporaire,
        message: "Notez le mot de passe temporaire maintenant : il ne sera plus jamais affiché.",
      };
    } catch (erreur) {
      if (estViolationUnicite(erreur)) throw new ConflictException("Ce téléphone, cet email ou ce nom d'utilisateur est déjà utilisé.");
      throw erreur;
    }
  }

  // =====================================================================
  //  MODIFICATION (identité et coordonnées)
  // =====================================================================
  async modifier(acteur: PayloadAcces, institutId: number, id: string, dto: ModifierUtilisateurDto, ctx: ContexteRequete) {
    const cible = await this.chargerCible(institutId, id);
    this.verifierDroit(acteur, cible, true); // chacun peut modifier ses propres coordonnées

    const data: Prisma.UtilisateurUpdateInput = {};
    if (dto.nom !== undefined) data.nom = dto.nom;
    if (dto.postnom !== undefined) data.postnom = dto.postnom;
    if (dto.prenom !== undefined) data.prenom = dto.prenom;

    let telephone: string | null | undefined;
    if (dto.telephone !== undefined) {
      telephone = normaliserTelephone(dto.telephone);
      if (!telephone) throw new BadRequestException('Numéro de téléphone invalide.');
      data.telephone = telephone;
    }
    if (dto.email !== undefined) data.email = dto.email;
    if (Object.keys(data).length === 0) throw new BadRequestException('Aucune modification fournie.');

    await this.verifierDisponibilite({ telephone: telephone ?? null, email: dto.email }, id);

    try {
      const apres = await this.prisma.utilisateur.update({ where: { id }, data, select: CHAMPS_UTILISATEUR });
      await this.audit.enregistrer({
        action: 'UTILISATEUR_MODIFIE',
        utilisateurId: acteur.sub,
        institutId,
        entite: 'utilisateurs',
        entiteId: id,
        avant: presenter(cible),
        apres: presenter(apres),
        ...ctx,
      });
      return presenter(apres);
    } catch (erreur) {
      if (estViolationUnicite(erreur)) throw new ConflictException('Ce téléphone ou cet email est déjà utilisé.');
      throw erreur;
    }
  }

  // =====================================================================
  //  MOT DE PASSE, VERROUILLAGE, ACTIVATION
  // =====================================================================
  async reinitialiserMotDePasse(acteur: PayloadAcces, institutId: number, id: string, ctx: ContexteRequete) {
    const cible = await this.chargerCible(institutId, id);
    this.verifierDroit(acteur, cible, false);

    const motDePasseTemporaire = genererMotDePasseTemporaire();
    await this.prisma.utilisateur.update({
      where: { id },
      data: {
        motDePasseHache: await hacherMotDePasse(motDePasseTemporaire),
        doitChangerMotDePasse: true,
        tentativesEchouees: 0,
        verrouilleJusqua: null,
      },
    });
    await this.revoquerSessions(id, 'MOT_DE_PASSE_REINITIALISE'); // l'ancien mot de passe ne doit plus ouvrir de session

    await this.audit.enregistrer({
      action: 'MOT_DE_PASSE_REINITIALISE',
      utilisateurId: acteur.sub,
      institutId,
      entite: 'utilisateurs',
      entiteId: id,
      ...ctx,
    });
    return {
      motDePasseTemporaire,
      message: "Transmettez ce mot de passe à la personne : il ne sera plus jamais affiché.",
    };
  }

  async deverrouiller(acteur: PayloadAcces, institutId: number, id: string, ctx: ContexteRequete) {
    const cible = await this.chargerCible(institutId, id);
    this.verifierDroit(acteur, cible, false);
    const maj = await this.prisma.utilisateur.update({
      where: { id },
      data: { tentativesEchouees: 0, verrouilleJusqua: null },
      select: CHAMPS_UTILISATEUR,
    });
    await this.audit.enregistrer({
      action: 'COMPTE_DEVERROUILLE',
      utilisateurId: acteur.sub,
      institutId,
      entite: 'utilisateurs',
      entiteId: id,
      ...ctx,
    });
    return presenter(maj);
  }

  async desactiver(acteur: PayloadAcces, institutId: number, id: string, motif: string, ctx: ContexteRequete) {
    const cible = await this.chargerCible(institutId, id);
    this.verifierDroit(acteur, cible, false);
    const maj = await this.prisma.utilisateur.update({ where: { id }, data: { actif: false }, select: CHAMPS_UTILISATEUR });
    await this.revoquerSessions(id, 'COMPTE_DESACTIVE');
    await this.audit.enregistrer({
      action: 'UTILISATEUR_DESACTIVE',
      utilisateurId: acteur.sub,
      institutId,
      entite: 'utilisateurs',
      entiteId: id,
      details: { motif },
      ...ctx,
    });
    return presenter(maj);
  }

  async activer(acteur: PayloadAcces, institutId: number, id: string, ctx: ContexteRequete) {
    const cible = await this.chargerCible(institutId, id);
    this.verifierDroit(acteur, cible, false);
    const maj = await this.prisma.utilisateur.update({ where: { id }, data: { actif: true }, select: CHAMPS_UTILISATEUR });
    await this.audit.enregistrer({
      action: 'UTILISATEUR_ACTIVE',
      utilisateurId: acteur.sub,
      institutId,
      entite: 'utilisateurs',
      entiteId: id,
      ...ctx,
    });
    return presenter(maj);
  }

  // =====================================================================
  //  OUTILS PRIVÉS
  // =====================================================================

  /**
   * Charge un utilisateur À L'INTÉRIEUR de l'institut courant.
   * Un utilisateur d'un autre institut renvoie 404 (et non 403) : on ne révèle pas qu'il existe.
   */
  private async chargerCible(institutId: number, id: string): Promise<UtilisateurLu> {
    const cible = await this.prisma.utilisateur.findFirst({
      where: { id, supprimeLe: null, ...dansInstitut(institutId) },
      select: CHAMPS_UTILISATEUR,
    });
    if (!cible) throw new NotFoundException('Utilisateur introuvable.');
    return cible;
  }

  /** Qui a le droit d'agir sur qui. */
  private verifierDroit(acteur: PayloadAcces, cible: UtilisateurLu, autoriserSoiMeme: boolean): void {
    if (cible.id === acteur.sub) {
      if (autoriserSoiMeme) return;
      throw new ForbiddenException('Vous ne pouvez pas effectuer cette action sur votre propre compte.');
    }
    if (cible.role.code === 'SUPER_ADMIN') throw new ForbiddenException('Action impossible sur ce compte.');
    if (acteur.role === 'DG' && cible.role.code !== 'SGAC' && cible.role.code !== 'ADMIN_BUDGET') {
      throw new ForbiddenException('Un DG ne gère que les SGAC et les Administrateurs du Budget.');
    }
  }

  private async verifierDisponibilite(
    valeurs: { telephone?: string | null; email?: string; nomUtilisateur?: string },
    exceptId?: string,
  ): Promise<void> {
    const criteres: Prisma.UtilisateurWhereInput[] = [];
    if (valeurs.telephone) criteres.push({ telephone: valeurs.telephone });
    if (valeurs.email) criteres.push({ email: valeurs.email });
    if (valeurs.nomUtilisateur) criteres.push({ nomUtilisateur: valeurs.nomUtilisateur });
    if (criteres.length === 0) return;
    const pris = await this.prisma.utilisateur.findFirst({
      where: { OR: criteres, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (pris) throw new ConflictException("Ce téléphone, cet email ou ce nom d'utilisateur est déjà utilisé.");
  }

  private async genererNomUtilisateur(prenom: string | undefined, nom: string): Promise<string> {
    const base = baseNomUtilisateur(prenom, nom);
    const existants = await this.prisma.utilisateur.findMany({
      where: { nomUtilisateur: { startsWith: base } },
      select: { nomUtilisateur: true },
    });
    const utilises = new Set(existants.map((e) => e.nomUtilisateur));
    let candidat = base;
    for (let i = 2; utilises.has(candidat); i++) candidat = `${base}${i}`;
    return candidat;
  }

  private revoquerSessions(utilisateurId: string, motif: string) {
    return this.prisma.jetonRafraichissement.updateMany({
      where: { utilisateurId, revoqueLe: null },
      data: { revoqueLe: new Date(), motifRevocation: motif },
    });
  }
}
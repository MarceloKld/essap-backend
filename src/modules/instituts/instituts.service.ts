import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { ContexteRequete } from '../auth/auth.types.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { verifierAccesInstitut } from '../../common/utils/acces-institut.js';
import { normaliserTelephone } from '../../common/utils/identifiants.js';
import { hacherMotDePasse } from '../../common/utils/mot-de-passe.js';
import { genererMotDePasseTemporaire } from '../../common/utils/mot-de-passe-temporaire.js';
import { baseNomUtilisateur } from '../../common/utils/nom-utilisateur.js';
import { PaginationDto, reponsePaginee } from '../../common/dto/pagination.dto.js';
import type { CreerInstitutDto } from './dto/creer-institut.dto.js';
import type { ModifierInstitutDto } from './dto/modifier-institut.dto.js';

// Champs d'un institut renvoyés par l'API (on choisit explicitement, jamais "tout").
const CHAMPS_INSTITUT = {
  id: true, code: true, nom: true, sigle: true, adresse: true, telephone: true,
  email: true, logoUrl: true, estPrincipal: true, actif: true, creeLe: true,
} satisfies Prisma.InstitutSelect;

// Personnel : JAMAIS le mot de passe haché, même par erreur.
const CHAMPS_PERSONNEL = {
  id: true, nomUtilisateur: true, nom: true, postnom: true, prenom: true, email: true,
  telephone: true, actif: true, doitChangerMotDePasse: true, derniereConnexionLe: true,
  role: { select: { code: true } },
} satisfies Prisma.UtilisateurSelect;

const nomComplet = (p: { nom: string; postnom: string | null; prenom: string | null }) =>
  [p.nom, p.postnom, p.prenom].filter(Boolean).join(' ');

type ResumePersonne = { id: string; nom: string; postnom: string | null; prenom: string | null; nomUtilisateur: string };

type AutoriteNouvelle = {
  genre: 'NOUVELLE';
  role: 'DG' | 'SGAC' | 'ADMIN_BUDGET';
  nomUtilisateur: string;
  nom: string;
  postnom: string | null;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  motDePasseTemporaire: string;
  motDePasseHache: string;
};
type AutoriteExistante = { genre: 'EXISTANTE'; role: 'DG'; personne: ResumePersonne };

const estViolationUnicite = (erreur: unknown): boolean =>
  typeof erreur === 'object' && erreur !== null && 'code' in erreur && (erreur as { code: unknown }).code === 'P2002';

@Injectable()
export class InstitutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // =====================================================================
  //  LISTE (paginée, avec recherche)
  // =====================================================================
  async lister(utilisateur: PayloadAcces, p: PaginationDto) {
    const where: Prisma.InstitutWhereInput = { supprimeLe: null };
    // Le Super Admin voit tout ; un DG ne voit QUE les instituts de sa liste.
    if (utilisateur.role !== 'SUPER_ADMIN') where.id = { in: utilisateur.institutsAutorises ?? [] };
    if (p.q) {
      where.OR = [
        { nom: { contains: p.q, mode: 'insensitive' } },
        { code: { contains: p.q, mode: 'insensitive' } },
        { sigle: { contains: p.q, mode: 'insensitive' } },
      ];
    }
    const [total, donnees] = await this.prisma.$transaction([
      this.prisma.institut.count({ where }),
      this.prisma.institut.findMany({
        where,
        select: CHAMPS_INSTITUT,
        orderBy: { id: 'asc' },
        skip: (p.page - 1) * p.limite,
        take: p.limite,
      }),
    ]);
    return reponsePaginee(donnees, total, p.page, p.limite);
  }

  // =====================================================================
  //  INSTITUT COURANT (celui que l'isolation a résolu pour cet appel)
  // =====================================================================
  async courant(institutId: number) {
    const institut = await this.prisma.institut.findFirst({
      where: { id: institutId, supprimeLe: null },
      select: CHAMPS_INSTITUT,
    });
    if (!institut) throw new NotFoundException('Institut introuvable.');
    return institut;
  }

  // =====================================================================
  //  DÉTAIL + AUTORITÉS
  // =====================================================================
  async detail(utilisateur: PayloadAcces, id: number) {
    verifierAccesInstitut(utilisateur, id);
    const institut = await this.prisma.institut.findFirst({
      where: { id, supprimeLe: null },
      select: { ...CHAMPS_INSTITUT, _count: { select: { utilisateurs: true, etudiants: true } } },
    });
    if (!institut) throw new NotFoundException('Institut introuvable.');

    // Personnel rattaché à l'institut (SGAC, Budget) + DG qui y ont accès.
    const personnel = await this.prisma.utilisateur.findMany({
      where: { supprimeLe: null, OR: [{ institutId: id }, { accesInstituts: { some: { institutId: id } } }] },
      select: CHAMPS_PERSONNEL,
      orderBy: { creeLe: 'asc' },
    });

    return {
      ...institut,
      autorites: personnel.map(({ role, ...p }) => ({ ...p, nomComplet: nomComplet(p), role: role.code })),
    };
  }

  // =====================================================================
  //  CRÉATION : institut + format de matricule + autorités, en UNE transaction
  // =====================================================================
  async creer(utilisateur: PayloadAcces, dto: CreerInstitutDto, ctx: ContexteRequete) {
    // 1) Unicité du code et du préfixe de matricule (deux instituts ne partagent jamais un préfixe).
    const [codePris, prefixePris] = await Promise.all([
      this.prisma.institut.findUnique({ where: { code: dto.code }, select: { id: true } }),
      this.prisma.parametre.findFirst({
        where: { cle: 'matricule.format', valeur: { path: ['prefixe'], equals: dto.prefixeMatricule } },
        select: { id: true },
      }),
    ]);
    if (codePris) throw new ConflictException('Ce code d\'institut existe déjà.');
    if (prefixePris) throw new ConflictException('Ce préfixe de matricule est déjà utilisé par un autre institut.');

    const telephoneInstitut = dto.telephone ? normaliserTelephone(dto.telephone) : null;
    if (dto.telephone && !telephoneInstitut) throw new BadRequestException('Téléphone de l\'institut invalide.');

    // 2) Préparation des autorités (vérifications, noms d'utilisateur, mots de passe)
    const roles = new Map((await this.prisma.role.findMany()).map((r) => [r.code, r.id]));
    const autorites = await this.preparerAutorites(dto);

    // 3) Transaction : tout réussit ou rien n'est créé.
    try {
      const resultat = await this.prisma.$transaction(
        async (tx) => {
          const institut = await tx.institut.create({
            data: {
              code: dto.code,
              nom: dto.nom,
              sigle: dto.sigle ?? null,
              adresse: dto.adresse ?? null,
              telephone: telephoneInstitut,
              email: dto.email ?? null,
            },
            select: CHAMPS_INSTITUT,
          });

          await tx.parametre.create({
            data: {
              institutId: institut.id,
              cle: 'matricule.format',
              valeur: { prefixe: dto.prefixeMatricule, longueurSequence: 4 },
              description: 'Préfixe + année + classe + numéro de séquence',
              modifiePar: utilisateur.sub,
            },
          });

          const sortie: Array<Record<string, string | boolean>> = [];
          for (const a of autorites) {
            if (a.genre === 'EXISTANTE') {
              await tx.accesInstitut.create({ data: { utilisateurId: a.personne.id, institutId: institut.id } });
              sortie.push({
                id: a.personne.id, role: 'DG', nomUtilisateur: a.personne.nomUtilisateur,
                nomComplet: nomComplet(a.personne), compteExistant: true,
              });
              continue;
            }
            const roleId = roles.get(a.role);
            if (roleId === undefined) throw new BadRequestException(`Rôle absent de la base : ${a.role}`);
            const cree = await tx.utilisateur.create({
              data: {
                nomUtilisateur: a.nomUtilisateur, email: a.email, telephone: a.telephone,
                motDePasseHache: a.motDePasseHache, nom: a.nom, postnom: a.postnom, prenom: a.prenom,
                roleId,
                institutId: a.role === 'DG' ? null : institut.id, // un DG n'est rattaché à aucun institut précis
                doitChangerMotDePasse: true, // modale de 1re connexion
                creePar: utilisateur.sub,
              },
              select: { id: true },
            });
            if (a.role === 'DG') {
              await tx.accesInstitut.create({ data: { utilisateurId: cree.id, institutId: institut.id } });
            }
            sortie.push({
              id: cree.id, role: a.role, nomUtilisateur: a.nomUtilisateur,
              nomComplet: nomComplet(a), motDePasseTemporaire: a.motDePasseTemporaire, compteExistant: false,
            });
          }
          return { institut, autorites: sortie };
        },
        { timeout: 15_000 },
      );

      await this.audit.enregistrer({
        action: 'INSTITUT_CREE',
        utilisateurId: utilisateur.sub,
        institutId: resultat.institut.id,
        entite: 'instituts',
        entiteId: String(resultat.institut.id),
        details: { code: dto.code, autorites: resultat.autorites.length },
        ...ctx,
      });

      return {
        ...resultat,
        message: 'Notez les mots de passe temporaires maintenant : ils ne seront plus jamais affichés.',
      };
    } catch (erreur) {
      if (estViolationUnicite(erreur)) throw new ConflictException('Un des éléments saisis existe déjà (code, nom d\'utilisateur, email ou téléphone).');
      throw erreur;
    }
  }

  // =====================================================================
  //  MODIFICATION (nom et coordonnées uniquement)
  // =====================================================================
  async modifier(utilisateur: PayloadAcces, id: number, dto: ModifierInstitutDto, ctx: ContexteRequete) {
    verifierAccesInstitut(utilisateur, id);
    const avant = await this.prisma.institut.findFirst({ where: { id, supprimeLe: null }, select: CHAMPS_INSTITUT });
    if (!avant) throw new NotFoundException('Institut introuvable.');

    const data: Prisma.InstitutUpdateInput = {};
    if (dto.nom !== undefined) data.nom = dto.nom;
    if (dto.sigle !== undefined) data.sigle = dto.sigle;
    if (dto.adresse !== undefined) data.adresse = dto.adresse;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.telephone !== undefined) {
      const tel = normaliserTelephone(dto.telephone);
      if (!tel) throw new BadRequestException('Téléphone invalide.');
      data.telephone = tel;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('Aucune modification fournie.');

    const apres = await this.prisma.institut.update({ where: { id }, data, select: CHAMPS_INSTITUT });
    await this.audit.enregistrer({
      action: 'INSTITUT_MODIFIE',
      utilisateurId: utilisateur.sub,
      institutId: id,
      entite: 'instituts',
      entiteId: String(id),
      avant,
      apres,
      ...ctx,
    });
    return apres;
  }

  // =====================================================================
  //  ACTIVATION / DÉSACTIVATION (Super Admin)
  // =====================================================================
  async desactiver(utilisateur: PayloadAcces, id: number, motif: string, ctx: ContexteRequete) {
    const institut = await this.chargerExistant(id);
    if (!institut.actif) return institut; // déjà désactivé : rien à faire

    const maj = await this.prisma.institut.update({ where: { id }, data: { actif: false }, select: CHAMPS_INSTITUT });

    // On coupe immédiatement les sessions de tous les utilisateurs et étudiants de cet institut.
    await this.prisma.jetonRafraichissement.updateMany({
      where: {
        revoqueLe: null,
        OR: [{ utilisateur: { institutId: id } }, { compteEtudiant: { etudiant: { institutId: id } } }],
      },
      data: { revoqueLe: new Date(), motifRevocation: 'INSTITUT_DESACTIVE' },
    });

    await this.audit.enregistrer({
      action: 'INSTITUT_DESACTIVE',
      utilisateurId: utilisateur.sub,
      institutId: id,
      entite: 'instituts',
      entiteId: String(id),
      details: { motif },
      ...ctx,
    });
    return maj;
  }

  async activer(utilisateur: PayloadAcces, id: number, ctx: ContexteRequete) {
    const institut = await this.chargerExistant(id);
    if (institut.actif) return institut;
    const maj = await this.prisma.institut.update({ where: { id }, data: { actif: true }, select: CHAMPS_INSTITUT });
    await this.audit.enregistrer({
      action: 'INSTITUT_ACTIVE',
      utilisateurId: utilisateur.sub,
      institutId: id,
      entite: 'instituts',
      entiteId: String(id),
      ...ctx,
    });
    return maj;
  }

  // =====================================================================
  //  OUTILS PRIVÉS
  // =====================================================================
  private async chargerExistant(id: number) {
    const institut = await this.prisma.institut.findFirst({ where: { id, supprimeLe: null }, select: CHAMPS_INSTITUT });
    if (!institut) throw new NotFoundException('Institut introuvable.');
    return institut;
  }

  /** Vérifie les autorités, rattache les DG existants, génère noms d'utilisateur et mots de passe temporaires. */
  private async preparerAutorites(dto: CreerInstitutDto): Promise<Array<AutoriteNouvelle | AutoriteExistante>> {
    const nouvelles: Array<Omit<AutoriteNouvelle, 'nomUtilisateur' | 'motDePasseTemporaire' | 'motDePasseHache'> & { nomUtilisateurDemande?: string }> = [];
    const existantes: AutoriteExistante[] = [];
    const ordre: Array<{ genre: 'NOUVELLE' | 'EXISTANTE'; index: number }> = [];

    for (const a of dto.autorites) {
      if (a.nomUtilisateurExistant) {
        if (a.role !== 'DG') throw new BadRequestException('Seul un DG existant peut être rattaché à un nouvel institut.');
        const personne = await this.prisma.utilisateur.findFirst({
          where: { nomUtilisateur: a.nomUtilisateurExistant, supprimeLe: null, role: { code: 'DG' } },
          select: { id: true, nom: true, postnom: true, prenom: true, nomUtilisateur: true },
        });
        if (!personne) throw new NotFoundException(`DG introuvable : ${a.nomUtilisateurExistant}`);
        ordre.push({ genre: 'EXISTANTE', index: existantes.length });
        existantes.push({ genre: 'EXISTANTE', role: 'DG', personne });
        continue;
      }

      const telephone = a.telephone ? normaliserTelephone(a.telephone) : null;
      if (a.telephone && !telephone) throw new BadRequestException(`Numéro de téléphone invalide : ${a.telephone}`);
      ordre.push({ genre: 'NOUVELLE', index: nouvelles.length });
      nouvelles.push({
        genre: 'NOUVELLE',
        role: a.role,
        nom: a.nom ?? '',
        postnom: a.postnom ?? null,
        prenom: a.prenom ?? null,
        email: a.email ?? null,
        telephone,
        nomUtilisateurDemande: a.nomUtilisateur,
      });
    }

    // Doublons à l'intérieur de la même demande
    const telephones = nouvelles.map((n) => n.telephone).filter((t): t is string => t !== null);
    const emails = nouvelles.map((n) => n.email).filter((e): e is string => e !== null);
    const demandes = nouvelles.map((n) => n.nomUtilisateurDemande).filter((u): u is string => u !== undefined);
    if (new Set(telephones).size !== telephones.length || new Set(emails).size !== emails.length || new Set(demandes).size !== demandes.length) {
      throw new BadRequestException('Deux autorités ont le même téléphone, email ou nom d\'utilisateur.');
    }

    // Conflits avec des comptes déjà existants
    const conflits = await this.prisma.utilisateur.findMany({
      where: { OR: [{ telephone: { in: telephones } }, { email: { in: emails } }, { nomUtilisateur: { in: demandes } }] },
      select: { telephone: true, email: true, nomUtilisateur: true },
    });
    if (conflits.length > 0) {
      throw new ConflictException('Un téléphone, un email ou un nom d\'utilisateur demandé est déjà utilisé par un autre compte.');
    }

    // Noms d'utilisateur : demandés, sinon générés (esther.kabongo, esther.kabongo2...)
    const pris = new Set<string>(demandes);
    const completes: AutoriteNouvelle[] = [];
    for (const n of nouvelles) {
      let nomUtilisateur = n.nomUtilisateurDemande;
      if (!nomUtilisateur) {
        const base = baseNomUtilisateur(n.prenom ?? undefined, n.nom);
        const existants = await this.prisma.utilisateur.findMany({
          where: { nomUtilisateur: { startsWith: base } },
          select: { nomUtilisateur: true },
        });
        const utilises = new Set([...existants.map((e) => e.nomUtilisateur), ...pris]);
        nomUtilisateur = base;
        for (let i = 2; utilises.has(nomUtilisateur); i++) nomUtilisateur = `${base}${i}`;
        pris.add(nomUtilisateur);
      }
      const motDePasseTemporaire = genererMotDePasseTemporaire();
      // Hachage Argon2 HORS de la transaction : il est volontairement lent.
      completes.push({
        ...n,
        nomUtilisateur,
        motDePasseTemporaire,
        motDePasseHache: await hacherMotDePasse(motDePasseTemporaire),
      });
    }

    // On remet les autorités dans l'ordre demandé par l'appelant.
    return ordre.map((o) => (o.genre === 'NOUVELLE' ? completes[o.index] : existantes[o.index]));
  }
}
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { JetonsService } from './jetons.service.js';
import { analyserIdentifiant } from '../../common/utils/identifiants.js';
import { hacherMotDePasse, verifierMotDePasse } from '../../common/utils/mot-de-passe.js';
import { dureeVerrouillageMinutes, egalEnTempsConstant, empreinteJeton } from '../../common/utils/securite.js';
import { versCodeRole, type PayloadAcces } from '../../common/types/jeton-acces.js';
import type { ContexteRequete, ProfilConnecte, ProprietaireJeton, ResultatSession } from './auth.types.js';

// Un SEUL message pour tous les cas d'échec : on ne révèle jamais si le compte existe.
const MESSAGE_PERSONNEL = 'Identifiant ou mot de passe incorrect, ou compte temporairement verrouillé.';
const MESSAGE_ETUDIANT = 'Matricule ou date de naissance incorrect, ou compte temporairement verrouillé.';

// Deux "refresh" simultanés (deux onglets de la PWA) ne doivent pas être pris pour un vol.
const TOLERANCE_REUTILISATION_MS = 10_000;

// Ce qu'on charge avec un membre du personnel (son rôle et ses instituts autorisés).
const INCLUSION_PERSONNEL = {
  role: true,
  accesInstituts: { select: { institutId: true } },
} satisfies Prisma.UtilisateurInclude;
type UtilisateurComplet = Prisma.UtilisateurGetPayload<{ include: typeof INCLUSION_PERSONNEL }>;

@Injectable()
export class AuthService {
  private empreinteFactice: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jetons: JetonsService,
    private readonly audit: AuditService,
  ) {}

  // =====================================================================
  //  CONNEXION DU PERSONNEL
  // =====================================================================
  async connecterPersonnel(identifiant: string, motDePasse: string, ctx: ContexteRequete): Promise<ResultatSession> {
    const { type, valeur } = analyserIdentifiant(identifiant);
    const filtre =
      type === 'EMAIL' ? { email: valeur } : type === 'TELEPHONE' ? { telephone: valeur } : { nomUtilisateur: valeur };

    const utilisateur = await this.prisma.utilisateur.findFirst({
      where: { ...filtre, supprimeLe: null },
      include: INCLUSION_PERSONNEL,
    });

    // Compte inconnu : on fait quand même un calcul Argon2 pour que la réponse
    // prenne le même temps (sinon le chronomètre révélerait que le compte n'existe pas).
    if (!utilisateur) {
      await this.simulerVerification(motDePasse);
      await this.audit.enregistrer({ action: 'CONNEXION_REFUSEE', details: { motif: 'IDENTIFIANT_INCONNU', type }, ...ctx });
      throw new UnauthorizedException(MESSAGE_PERSONNEL);
    }

    const maintenant = new Date();
    const verrouille = utilisateur.verrouilleJusqua !== null && utilisateur.verrouilleJusqua > maintenant;
    if (!utilisateur.actif || verrouille) {
      await this.simulerVerification(motDePasse);
      await this.audit.enregistrer({
        action: 'CONNEXION_REFUSEE',
        utilisateurId: utilisateur.id,
        institutId: utilisateur.institutId,
        details: { motif: utilisateur.actif ? 'COMPTE_VERROUILLE' : 'COMPTE_INACTIF' },
        ...ctx,
      });
      throw new UnauthorizedException(MESSAGE_PERSONNEL);
    }

    const valide = await verifierMotDePasse(utilisateur.motDePasseHache, motDePasse);
    if (!valide) {
      await this.enregistrerEchecPersonnel(utilisateur.id, utilisateur.institutId, ctx);
      throw new UnauthorizedException(MESSAGE_PERSONNEL);
    }

    // Succès : on remet le compteur à zéro.
    await this.prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: { tentativesEchouees: 0, verrouilleJusqua: null, derniereConnexionLe: maintenant },
    });

    const session = await this.ouvrirSession(
      this.payloadPersonnel(utilisateur),
      { utilisateurId: utilisateur.id },
      this.profilPersonnel(utilisateur),
      utilisateur.doitChangerMotDePasse,
      ctx,
    );
    await this.audit.enregistrer({
      action: 'CONNEXION_REUSSIE',
      utilisateurId: utilisateur.id,
      institutId: utilisateur.institutId,
      ...ctx,
    });
    return session;
  }

  // =====================================================================
  //  CONNEXION DE L'ÉTUDIANT : matricule + date de naissance
  // =====================================================================
  async connecterEtudiant(matricule: string, dateNaissance: string, ctx: ContexteRequete): Promise<ResultatSession> {
    const etudiant = await this.prisma.etudiant.findFirst({
      where: { matricule, supprimeLe: null },
      include: { compte: true },
    });
    const compte = etudiant?.compte;
    const maintenant = new Date();

    if (!etudiant || !compte || !compte.actif || (compte.verrouilleJusqua && compte.verrouilleJusqua > maintenant)) {
      await this.audit.enregistrer({
        action: 'CONNEXION_ETUDIANT_REFUSEE',
        institutId: etudiant?.institutId ?? null,
        entite: 'etudiants',
        entiteId: etudiant?.id,
        details: { motif: !etudiant ? 'MATRICULE_INCONNU' : 'COMPTE_INDISPONIBLE' },
        ...ctx,
      });
      throw new UnauthorizedException(MESSAGE_ETUDIANT);
    }

    // La date de naissance est en base au format AAAA-MM-JJ : on compare en temps constant.
    const attendue = etudiant.dateNaissance.toISOString().slice(0, 10);
    if (!egalEnTempsConstant(attendue, dateNaissance)) {
      const maj = await this.prisma.compteEtudiant.update({
        where: { id: compte.id },
        data: { tentativesEchouees: { increment: 1 } },
        select: { tentativesEchouees: true },
      });
      const minutes = dureeVerrouillageMinutes(maj.tentativesEchouees);
      if (minutes > 0) {
        await this.prisma.compteEtudiant.update({
          where: { id: compte.id },
          data: { verrouilleJusqua: new Date(Date.now() + minutes * 60_000) },
        });
      }
      await this.audit.enregistrer({
        action: 'CONNEXION_ETUDIANT_ECHOUEE',
        institutId: etudiant.institutId,
        entite: 'etudiants',
        entiteId: etudiant.id,
        details: { tentatives: maj.tentativesEchouees, verrouillageMinutes: minutes },
        ...ctx,
      });
      throw new UnauthorizedException(MESSAGE_ETUDIANT);
    }

    await this.prisma.compteEtudiant.update({
      where: { id: compte.id },
      data: { tentativesEchouees: 0, verrouilleJusqua: null, derniereConnexionLe: maintenant },
    });

    const session = await this.ouvrirSession(
      this.payloadEtudiant(etudiant),
      { compteEtudiantId: compte.id },
      this.profilEtudiant(etudiant),
      false,
      ctx,
    );
    await this.audit.enregistrer({
      action: 'CONNEXION_ETUDIANT_REUSSIE',
      institutId: etudiant.institutId,
      entite: 'etudiants',
      entiteId: etudiant.id,
      ...ctx,
    });
    return session;
  }

  // =====================================================================
  //  RAFRAÎCHISSEMENT AVEC ROTATION
  // =====================================================================
  async rafraichir(jetonBrut: string, ctx: ContexteRequete): Promise<ResultatSession> {
    const jeton = await this.prisma.jetonRafraichissement.findUnique({
      where: { empreinte: empreinteJeton(jetonBrut) },
      include: {
        utilisateur: { include: INCLUSION_PERSONNEL },
        compteEtudiant: { include: { etudiant: true } },
      },
    });
    if (!jeton) throw new UnauthorizedException('Session invalide.');

    const maintenant = new Date();
    if (jeton.revoqueLe || jeton.expireLe <= maintenant) throw new UnauthorizedException('Session expirée.');

    // Jeton DÉJÀ utilisé : soit deux onglets simultanés (toléré), soit un VOL (on coupe tout).
    if (jeton.utiliseLe) {
      if (maintenant.getTime() - jeton.utiliseLe.getTime() > TOLERANCE_REUTILISATION_MS) {
        await this.jetons.revoquerFamille(jeton.familleId, 'REUTILISATION_DETECTEE');
        await this.audit.enregistrer({
          action: 'JETON_REUTILISE',
          utilisateurId: jeton.utilisateurId,
          details: { familleId: jeton.familleId },
          ...ctx,
        });
      }
      throw new UnauthorizedException('Session invalide.');
    }

    // On marque le jeton "utilisé" de façon ATOMIQUE : si deux requêtes arrivent en même temps,
    // une seule obtient count = 1.
    const { count } = await this.prisma.jetonRafraichissement.updateMany({
      where: { id: jeton.id, utiliseLe: null, revoqueLe: null },
      data: { utiliseLe: maintenant },
    });
    if (count !== 1) throw new UnauthorizedException('Session invalide.');

    // On recharge la personne : si son compte a été désactivé ou son rôle changé, on le voit ici.
    if (jeton.utilisateur) {
      const u = jeton.utilisateur;
      if (!u.actif || u.supprimeLe) {
        await this.jetons.revoquerFamille(jeton.familleId, 'COMPTE_DESACTIVE');
        throw new UnauthorizedException('Session invalide.');
      }
      return this.ouvrirSession(
        this.payloadPersonnel(u),
        { utilisateurId: u.id },
        this.profilPersonnel(u),
        u.doitChangerMotDePasse,
        ctx,
        jeton.familleId,
      );
    }

    const compte = jeton.compteEtudiant;
    if (compte && compte.actif && !compte.etudiant.supprimeLe) {
      return this.ouvrirSession(
        this.payloadEtudiant(compte.etudiant),
        { compteEtudiantId: compte.id },
        this.profilEtudiant(compte.etudiant),
        false,
        ctx,
        jeton.familleId,
      );
    }
    await this.jetons.revoquerFamille(jeton.familleId, 'COMPTE_DESACTIVE');
    throw new UnauthorizedException('Session invalide.');
  }

  // =====================================================================
  //  DÉCONNEXION
  // =====================================================================
  async deconnecter(jetonBrut: string | undefined, ctx: ContexteRequete): Promise<void> {
    if (!jetonBrut) return;
    const jeton = await this.prisma.jetonRafraichissement.findUnique({
      where: { empreinte: empreinteJeton(jetonBrut) },
      select: { familleId: true, utilisateurId: true },
    });
    if (!jeton) return;
    await this.jetons.revoquerFamille(jeton.familleId, 'DECONNEXION');
    await this.audit.enregistrer({ action: 'DECONNEXION', utilisateurId: jeton.utilisateurId, ...ctx });
  }

  async deconnecterPartout(payload: PayloadAcces, ctx: ContexteRequete): Promise<void> {
    let proprietaire: ProprietaireJeton | null = null;
    if (payload.type === 'PERSONNEL') {
      proprietaire = { utilisateurId: payload.sub };
    } else {
      const compte = await this.prisma.compteEtudiant.findUnique({ where: { etudiantId: payload.sub } });
      if (compte) proprietaire = { compteEtudiantId: compte.id };
    }
    if (proprietaire) await this.jetons.revoquerTous(proprietaire, 'DECONNEXION_PARTOUT');
    await this.audit.enregistrer({
      action: 'DECONNEXION_PARTOUT',
      utilisateurId: payload.type === 'PERSONNEL' ? payload.sub : null,
      institutId: payload.institutId,
      ...ctx,
    });
  }

  // =====================================================================
  //  PROFIL ET MOT DE PASSE
  // =====================================================================
  async moi(payload: PayloadAcces) {
    if (payload.type === 'PERSONNEL') {
      const u = await this.prisma.utilisateur.findUnique({ where: { id: payload.sub }, include: INCLUSION_PERSONNEL });
      if (!u || !u.actif || u.supprimeLe) throw new UnauthorizedException('Session invalide.');
      return {
        profil: this.profilPersonnel(u),
        doitChangerMotDePasse: u.doitChangerMotDePasse,
        institutsAutorises: payload.institutsAutorises,
      };
    }
    const e = await this.prisma.etudiant.findUnique({ where: { id: payload.sub } });
    if (!e || e.supprimeLe) throw new UnauthorizedException('Session invalide.');
    return { profil: this.profilEtudiant(e), doitChangerMotDePasse: false, institutsAutorises: payload.institutsAutorises };
  }

  async changerMotDePasse(
    payload: PayloadAcces,
    actuel: string,
    nouveau: string,
    jetonCourantBrut: string | undefined,
    ctx: ContexteRequete,
  ): Promise<void> {
    if (payload.type !== 'PERSONNEL') throw new ForbiddenException('Action réservée au personnel.');

    const u = await this.prisma.utilisateur.findUnique({ where: { id: payload.sub } });
    if (!u || !u.actif || u.supprimeLe) throw new UnauthorizedException('Session invalide.');

    // Même protection qu'à la connexion : un jeton volé ne doit pas permettre de deviner le mot de passe.
    if (!(await verifierMotDePasse(u.motDePasseHache, actuel))) {
      await this.enregistrerEchecPersonnel(u.id, u.institutId, ctx);
      throw new BadRequestException('Le mot de passe actuel est incorrect.');
    }
    if (actuel === nouveau) throw new BadRequestException("Le nouveau mot de passe doit être différent de l'ancien.");

    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: {
        motDePasseHache: await hacherMotDePasse(nouveau),
        doitChangerMotDePasse: false,
        tentativesEchouees: 0,
        verrouilleJusqua: null,
      },
    });

    // On coupe toutes les AUTRES sessions (si quelqu'un d'autre était connecté avec l'ancien mot de passe).
    let familleCourante: string | undefined;
    if (jetonCourantBrut) {
      const j = await this.prisma.jetonRafraichissement.findUnique({
        where: { empreinte: empreinteJeton(jetonCourantBrut) },
        select: { familleId: true, utilisateurId: true },
      });
      if (j?.utilisateurId === u.id) familleCourante = j.familleId;
    }
    await this.jetons.revoquerTous({ utilisateurId: u.id }, 'MOT_DE_PASSE_CHANGE', familleCourante);
    await this.audit.enregistrer({ action: 'MOT_DE_PASSE_CHANGE', utilisateurId: u.id, institutId: u.institutId, ...ctx });
  }

  /** « Garder » le mot de passe temporaire : la modale de 1re connexion ne s'affichera plus. */
  async garderMotDePasse(payload: PayloadAcces, ctx: ContexteRequete): Promise<void> {
    if (payload.type !== 'PERSONNEL') throw new ForbiddenException('Action réservée au personnel.');
    await this.prisma.utilisateur.update({ where: { id: payload.sub }, data: { doitChangerMotDePasse: false } });
    await this.audit.enregistrer({
      action: 'MOT_DE_PASSE_TEMPORAIRE_CONSERVE',
      utilisateurId: payload.sub,
      institutId: payload.institutId,
      ...ctx,
    });
  }

  // =====================================================================
  //  OUTILS PRIVÉS
  // =====================================================================
  private async ouvrirSession(
    payload: PayloadAcces,
    proprietaire: ProprietaireJeton,
    profil: ProfilConnecte,
    doitChangerMotDePasse: boolean,
    ctx: ContexteRequete,
    familleId?: string,
  ): Promise<ResultatSession> {
    const jetonAcces = await this.jetons.creerAcces(payload);
    const rafraichissement = await this.jetons.emettreRafraichissement(proprietaire, ctx, familleId);
    return {
      jetonAcces,
      expireDansSecondes: this.jetons.dureeAccesSecondes,
      rafraichissement: rafraichissement.jeton,
      rafraichissementExpireLe: rafraichissement.expireLe,
      doitChangerMotDePasse,
      profil,
    };
  }

  private async enregistrerEchecPersonnel(utilisateurId: string, institutId: number | null, ctx: ContexteRequete) {
    // "increment" est exécuté par la base elle-même : sûr même si deux tentatives arrivent en même temps.
    const maj = await this.prisma.utilisateur.update({
      where: { id: utilisateurId },
      data: { tentativesEchouees: { increment: 1 } },
      select: { tentativesEchouees: true },
    });
    const minutes = dureeVerrouillageMinutes(maj.tentativesEchouees);
    if (minutes > 0) {
      await this.prisma.utilisateur.update({
        where: { id: utilisateurId },
        data: { verrouilleJusqua: new Date(Date.now() + minutes * 60_000) },
      });
    }
    await this.audit.enregistrer({
      action: 'CONNEXION_ECHOUEE',
      utilisateurId,
      institutId,
      details: { tentatives: maj.tentativesEchouees, verrouillageMinutes: minutes },
      ...ctx,
    });
  }

  private simulerVerification(motDePasse: string): Promise<boolean> {
    this.empreinteFactice ??= hacherMotDePasse('mot-de-passe-factice-pour-egaliser-le-temps');
    return this.empreinteFactice.then((empreinte) => verifierMotDePasse(empreinte, motDePasse));
  }

  private payloadPersonnel(u: UtilisateurComplet): PayloadAcces {
    const role = versCodeRole(u.role.code);
    let institutsAutorises: number[] | null;
    if (role === 'SUPER_ADMIN') institutsAutorises = null; // tous les instituts
    else if (role === 'DG') institutsAutorises = u.accesInstituts.map((a) => a.institutId);
    else institutsAutorises = u.institutId !== null ? [u.institutId] : [];
    return { sub: u.id, type: 'PERSONNEL', role, institutId: u.institutId, institutsAutorises };
  }

  private payloadEtudiant(e: { id: string; institutId: number }): PayloadAcces {
    return { sub: e.id, type: 'ETUDIANT', role: 'ETUDIANT', institutId: e.institutId, institutsAutorises: [e.institutId] };
  }

  private profilPersonnel(u: UtilisateurComplet): ProfilConnecte {
    return {
      id: u.id,
      type: 'PERSONNEL',
      role: versCodeRole(u.role.code),
      nomComplet: [u.nom, u.postnom, u.prenom].filter(Boolean).join(' '),
      institutId: u.institutId,
      nomUtilisateur: u.nomUtilisateur,
      email: u.email,
      telephone: u.telephone,
    };
  }

  private profilEtudiant(e: {
    id: string;
    institutId: number;
    matricule: string | null;
    nom: string;
    postnom: string | null;
    prenom: string | null;
  }): ProfilConnecte {
    return {
      id: e.id,
      type: 'ETUDIANT',
      role: 'ETUDIANT',
      nomComplet: [e.nom, e.postnom, e.prenom].filter(Boolean).join(' '),
      institutId: e.institutId,
      matricule: e.matricule ?? undefined,
    };
  }
}
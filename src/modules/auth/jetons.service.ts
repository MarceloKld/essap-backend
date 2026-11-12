import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { empreinteJeton, genererJetonOpaque } from '../../common/utils/securite.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import type { ContexteRequete, ProprietaireJeton } from './auth.types.js';

/**
 * Deux sortes de jetons :
 *  - JETON D'ACCÈS (JWT, 15 min)  : prouve l'identité à chaque requête. Le front le garde en mémoire.
 *  - JETON DE RAFRAÎCHISSEMENT (opaque, 7 jours) : sert uniquement à obtenir un nouveau jeton d'accès.
 *    Il vit dans un cookie HttpOnly. En base : seulement son empreinte.
 *
 * "famille" = tous les jetons issus d'un même login. Si un ancien jeton est rejoué (vol probable),
 * on révoque TOUTE la famille d'un coup.
 */
@Injectable()
export class JetonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  get dureeAccesSecondes(): number {
    return Number(this.config.getOrThrow('JWT_ACCES_DUREE_SECONDES'));
  }

  creerAcces(payload: PayloadAcces): Promise<string> {
    return this.jwt.signAsync({ ...payload });
  }

  async emettreRafraichissement(
    proprietaire: ProprietaireJeton,
    contexte: ContexteRequete,
    familleId?: string,
  ): Promise<{ jeton: string; expireLe: Date }> {
    const jeton = genererJetonOpaque();
    const jours = Number(this.config.getOrThrow('REFRESH_DUREE_JOURS'));
    const expireLe = new Date(Date.now() + jours * 86_400_000);

    await this.prisma.jetonRafraichissement.create({
      data: {
        familleId: familleId ?? randomUUID(), // nouvelle famille à chaque login, même famille à chaque rotation
        empreinte: empreinteJeton(jeton),
        utilisateurId: proprietaire.utilisateurId ?? null,
        compteEtudiantId: proprietaire.compteEtudiantId ?? null,
        appareil: contexte.appareil,
        adresseIp: contexte.adresseIp,
        expireLe,
      },
    });
    return { jeton, expireLe };
  }

  revoquerFamille(familleId: string, motif: string) {
    return this.prisma.jetonRafraichissement.updateMany({
      where: { familleId, revoqueLe: null },
      data: { revoqueLe: new Date(), motifRevocation: motif },
    });
  }

  /** Révoque toutes les sessions d'une personne, sauf éventuellement la famille "sauf". */
  revoquerTous(proprietaire: ProprietaireJeton, motif: string, sauf?: string) {
    return this.prisma.jetonRafraichissement.updateMany({
      where: {
        revoqueLe: null,
        ...(proprietaire.utilisateurId
          ? { utilisateurId: proprietaire.utilisateurId }
          : { compteEtudiantId: proprietaire.compteEtudiantId }),
        ...(sauf ? { familleId: { not: sauf } } : {}),
      },
      data: { revoqueLe: new Date(), motifRevocation: motif },
    });
  }
}
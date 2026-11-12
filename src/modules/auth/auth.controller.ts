import {
  Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Patch, Post, Req, Res, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { AuthService } from './auth.service.js';
import { CHEMIN_COOKIE, NOM_COOKIE_RAFRAICHISSEMENT } from './auth.constantes.js';
import type { ContexteRequete, ResultatSession } from './auth.types.js';
import { ConnexionPersonnelDto } from './dto/connexion-personnel.dto.js';
import { ConnexionEtudiantDto } from './dto/connexion-etudiant.dto.js';
import { ChangerMotDePasseDto } from './dto/changer-mot-de-passe.dto.js';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  private readonly originesAutorisees: string[];
  private readonly cookiesSecurises: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.originesAutorisees = [new URL(config.getOrThrow<string>('FRONTEND_URL')).origin];
    // En développement, Swagger (servi par l'API elle-même) peut aussi appeler ces routes.
    if (config.get('NODE_ENV') !== 'production') {
      this.originesAutorisees.push(`http://localhost:${config.get('PORT') ?? 4000}`);
    }
    this.cookiesSecurises = String(config.get('COOKIES_SECURISES')) === 'true';
  }

  // --- Connexion du personnel : 10 essais par minute et par IP au maximum ---
  @Public()
  @Throttle({ defaut: { limit: 10, ttl: 60_000 } })
  @Post('connexion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion du personnel (utilisateur, email ou téléphone + mot de passe)' })
  async connexion(
    @Body() dto: ConnexionPersonnelDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.connecterPersonnel(dto.identifiant, dto.motDePasse, this.contexte(req));
    return this.repondre(res, session);
  }

  @Public()
  @Throttle({ defaut: { limit: 10, ttl: 60_000 } })
  @Post('connexion-etudiant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion étudiant (matricule + date de naissance)' })
  async connexionEtudiant(
    @Body() dto: ConnexionEtudiantDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.connecterEtudiant(dto.matricule, dto.dateNaissance, this.contexte(req));
    return this.repondre(res, session);
  }

  @Public()
  @Throttle({ defaut: { limit: 30, ttl: 60_000 } })
  @Post('rafraichir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nouveau jeton d\'accès (le refresh token est lu dans le cookie, puis remplacé)' })
  async rafraichir(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.verifierOrigine(req);
    const jeton = this.lireCookie(req);
    if (!jeton) throw new UnauthorizedException('Session absente.');
    try {
      return this.repondre(res, await this.auth.rafraichir(jeton, this.contexte(req)));
    } catch (erreur) {
      this.effacerCookie(res); // le cookie est inutilisable : on le supprime du navigateur
      throw erreur;
    }
  }

  @Public()
  @Post('deconnexion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ferme la session de cet appareil' })
  async deconnexion(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.verifierOrigine(req);
    await this.auth.deconnecter(this.lireCookie(req), this.contexte(req));
    this.effacerCookie(res);
  }

  @ApiBearerAuth()
  @Post('deconnexion-partout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ferme TOUTES les sessions de la personne connectée' })
  async deconnexionPartout(
    @UtilisateurCourant() utilisateur: PayloadAcces,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.deconnecterPartout(utilisateur, this.contexte(req));
    this.effacerCookie(res);
  }

  @ApiBearerAuth()
  @Get('moi')
  @ApiOperation({ summary: 'Profil de la personne connectée' })
  moi(@UtilisateurCourant() utilisateur: PayloadAcces) {
    return this.auth.moi(utilisateur);
  }

  @ApiBearerAuth()
  @Throttle({ defaut: { limit: 5, ttl: 60_000 } })
  @Patch('mot-de-passe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Changer son mot de passe (personnel)' })
  async changerMotDePasse(
    @UtilisateurCourant() utilisateur: PayloadAcces,
    @Body() dto: ChangerMotDePasseDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.changerMotDePasse(
      utilisateur,
      dto.motDePasseActuel,
      dto.nouveauMotDePasse,
      this.lireCookie(req),
      this.contexte(req),
    );
  }

  @ApiBearerAuth()
  @Post('mot-de-passe/garder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Garder le mot de passe temporaire (ferme la modale de 1re connexion)' })
  async garderMotDePasse(@UtilisateurCourant() utilisateur: PayloadAcces, @Req() req: Request): Promise<void> {
    await this.auth.garderMotDePasse(utilisateur, this.contexte(req));
  }

  // ------------------------------------------------------------------
  //  Outils privés
  // ------------------------------------------------------------------

  /** Place le refresh token dans un cookie sécurisé et renvoie le reste dans le corps. */
  private repondre(res: Response, session: ResultatSession) {
    res.cookie(NOM_COOKIE_RAFRAICHISSEMENT, session.rafraichissement, {
      httpOnly: true, // illisible par JavaScript : un vol par XSS devient impossible
      secure: this.cookiesSecurises, // HTTPS obligatoire en production
      sameSite: 'strict', // jamais envoyé depuis un autre site (anti-CSRF)
      path: CHEMIN_COOKIE,
      expires: session.rafraichissementExpireLe,
    });
    return {
      jetonAcces: session.jetonAcces,
      expireDansSecondes: session.expireDansSecondes,
      doitChangerMotDePasse: session.doitChangerMotDePasse,
      profil: session.profil,
    };
  }

  private effacerCookie(res: Response): void {
    res.clearCookie(NOM_COOKIE_RAFRAICHISSEMENT, {
      httpOnly: true,
      secure: this.cookiesSecurises,
      sameSite: 'strict',
      path: CHEMIN_COOKIE,
    });
  }

  private lireCookie(req: Request): string | undefined {
    const valeur: unknown = req.cookies?.[NOM_COOKIE_RAFRAICHISSEMENT];
    return typeof valeur === 'string' && valeur.length > 0 ? valeur : undefined;
  }

  /**
   * Protection CSRF en plus de SameSite : si le navigateur indique d'où vient la requête
   * (en-tête Origin), ce doit être NOTRE front. Postman/PowerShell n'envoient pas Origin : acceptés.
   */
  private verifierOrigine(req: Request): void {
    const origine = req.headers.origin;
    if (origine && !this.originesAutorisees.includes(origine)) throw new ForbiddenException('Origine non autorisée.');
  }

  private contexte(req: Request): ContexteRequete {
    const appareil = (req.headers['user-agent'] ?? '').slice(0, 255);
    return { adresseIp: req.ip ?? null, appareil: appareil || null };
  }
}
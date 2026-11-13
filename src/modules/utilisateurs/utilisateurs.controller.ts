import {
  Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InstitutCourant } from '../../common/decorators/institut-courant.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { contexteRequete } from '../../common/utils/contexte-requete.js';
import { CreerUtilisateurDto } from './dto/creer-utilisateur.dto.js';
import { DesactiverUtilisateurDto } from './dto/desactiver-utilisateur.dto.js';
import { ListerUtilisateursDto } from './dto/lister-utilisateurs.dto.js';
import { ModifierUtilisateurDto } from './dto/modifier-utilisateur.dto.js';
import { UtilisateursService } from './utilisateurs.service.js';

/**
 * Toutes les routes : DG (et Super Admin, qui passe toujours), dans l'INSTITUT COURANT.
 * @InstitutCourant() lit X-Institut-Id et le vérifie contre la liste d'instituts du jeton.
 */
@ApiTags('Utilisateurs (personnel)')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Institut-Id', required: false, description: 'Obligatoire si vous avez accès à plusieurs instituts.' })
@Roles('DG')
@Controller('utilisateurs')
export class UtilisateursController {
  constructor(private readonly utilisateurs: UtilisateursService) {}

  @Post()
  @Header('Cache-Control', 'no-store') // la réponse contient un mot de passe
  @ApiOperation({ summary: 'Créer un SGAC / Administrateur du Budget (mot de passe temporaire généré)' })
  creer(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Body() dto: CreerUtilisateurDto,
    @Req() req: Request,
  ) {
    return this.utilisateurs.creer(acteur, institutId, dto, contexteRequete(req));
  }

  @Get()
  @ApiOperation({ summary: "Lister le personnel de l'institut (pagination, recherche, filtre par rôle)" })
  lister(@InstitutCourant() institutId: number, @Query() filtres: ListerUtilisateursDto) {
    return this.utilisateurs.lister(institutId, filtres);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un membre du personnel" })
  detail(@InstitutCourant() institutId: number, @Param('id', ParseUUIDPipe) id: string) {
    return this.utilisateurs.detail(institutId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier nom, téléphone, email' })
  modifier(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModifierUtilisateurDto,
    @Req() req: Request,
  ) {
    return this.utilisateurs.modifier(acteur, institutId, id, dto, contexteRequete(req));
  }

  @Post(':id/reinitialiser-mot-de-passe')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Réinitialiser le mot de passe (nouveau mot de passe temporaire, sessions coupées)' })
  reinitialiser(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.utilisateurs.reinitialiserMotDePasse(acteur, institutId, id, contexteRequete(req));
  }

  @Post(':id/deverrouiller')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lever le verrouillage après des échecs de connexion' })
  deverrouiller(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.utilisateurs.deverrouiller(acteur, institutId, id, contexteRequete(req));
  }

  @Post(':id/desactiver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Désactiver un compte (ses sessions sont coupées)' })
  desactiver(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DesactiverUtilisateurDto,
    @Req() req: Request,
  ) {
    return this.utilisateurs.desactiver(acteur, institutId, id, dto.motif, contexteRequete(req));
  }

  @Post(':id/activer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réactiver un compte' })
  activer(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.utilisateurs.activer(acteur, institutId, id, contexteRequete(req));
  }
}
import {
  BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, ParseIntPipe,
  Patch, Post, Put, Query, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { InstitutCourant } from '../../common/decorators/institut-courant.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { contexteRequete } from '../../common/utils/contexte-requete.js';
import { CreerInstitutDto } from './dto/creer-institut.dto.js';
import { DesactiverInstitutDto } from './dto/desactiver-institut.dto.js';
import { ModifierInstitutDto } from './dto/modifier-institut.dto.js';
import { InstitutsService } from './instituts.service.js';
import type { FichierEnvoye } from '../../common/types/fichier-envoye.js';
import { LogoService } from './logo.service.js';

const TAILLE_MAX_LOGO_OCTETS = 5 * 1024 * 1024; // 5 Mo
const TYPES_LOGO = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Premier filtre, rapide, sur le type ANNONCÉ par le navigateur (falsifiable).
 * Le vrai contrôle, sur le contenu réel du fichier, est fait ensuite par ImageService.
 */
function filtreLogo(
  _requete: unknown,
  fichier: { mimetype: string },
  rappel: (erreur: Error | null, accepter: boolean) => void,
): void {
  if (TYPES_LOGO.includes(fichier.mimetype)) rappel(null, true);
  else rappel(new BadRequestException('Format non autorisé : PNG, JPEG ou WebP uniquement.'), false);
}

@ApiTags('Instituts')
@ApiBearerAuth()
@Controller('instituts')
export class InstitutsController {
  constructor(
    private readonly instituts: InstitutsService,
    private readonly logo: LogoService,
  ) {}

  @Post()
  @Roles('SUPER_ADMIN')
  @Header('Cache-Control', 'no-store') // la réponse contient des mots de passe : jamais en cache
  @ApiOperation({ summary: 'Créer un institut avec ses autorités (Super Admin)' })
  creer(@UtilisateurCourant() utilisateur: PayloadAcces, @Body() dto: CreerInstitutDto, @Req() req: Request) {
    return this.instituts.creer(utilisateur, dto, contexteRequete(req));
  }

  @Get()
  @Roles('DG')
  @ApiOperation({ summary: 'Lister les instituts accessibles (DG : les siens ; Super Admin : tous)' })
  lister(@UtilisateurCourant() utilisateur: PayloadAcces, @Query() pagination: PaginationDto) {
    return this.instituts.lister(utilisateur, pagination);
  }

  // ATTENTION : cette route doit être AVANT « :id », sinon « courant » serait pris pour un identifiant.
  @Get('courant')
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiHeader({
    name: 'X-Institut-Id',
    required: false,
    description: 'Obligatoire pour un DG (plusieurs instituts) et le Super Admin. Ignoré pour SGAC et Administrateur du Budget.',
  })
  @ApiOperation({ summary: "Institut sur lequel l'appel agit (illustre l'isolation)" })
  courant(@InstitutCourant() institutId: number) {
    return this.instituts.courant(institutId);
  }

  @Get(':id')
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiOperation({ summary: "Détails d'un institut et de ses autorités" })
  detail(@UtilisateurCourant() utilisateur: PayloadAcces, @Param('id', ParseIntPipe) id: number) {
    return this.instituts.detail(utilisateur, id);
  }

  @Patch(':id')
  @Roles('DG')
  @ApiOperation({ summary: "Modifier le nom et les coordonnées d'un institut" })
  modifier(
    @UtilisateurCourant() utilisateur: PayloadAcces,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModifierInstitutDto,
    @Req() req: Request,
  ) {
    return this.instituts.modifier(utilisateur, id, dto, contexteRequete(req));
  }

  // ---------------------------------------------------------------- LOGO
  @Put(':id/logo')
  @Roles('DG')
  @Throttle({ defaut: { limit: 10, ttl: 60_000 } }) // plafonne les envois vers Cloudinary
  @UseInterceptors(
    FileInterceptor('fichier', {
      limits: { fileSize: TAILLE_MAX_LOGO_OCTETS, files: 1 }, // au-delà de 5 Mo : erreur 413
      fileFilter: filtreLogo,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { fichier: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Envoyer le logo (PNG/JPEG/WebP, 5 Mo max) : réduit et converti en WebP' })
  definirLogo(
    @UtilisateurCourant() utilisateur: PayloadAcces,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() fichier: FichierEnvoye | undefined,
    @Req() req: Request,
  ) {
    return this.logo.definir(utilisateur, id, fichier, contexteRequete(req));
  }

  @Delete(':id/logo')
  @Roles('DG')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Supprimer le logo d'un institut" })
  supprimerLogo(@UtilisateurCourant() utilisateur: PayloadAcces, @Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.logo.supprimer(utilisateur, id, contexteRequete(req));
  }

  // ----------------------------------------------------- ÉTAT DE L'INSTITUT
  @Post(':id/desactiver')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Désactiver un institut (bloque ses utilisateurs et étudiants)' })
  desactiver(
    @UtilisateurCourant() utilisateur: PayloadAcces,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DesactiverInstitutDto,
    @Req() req: Request,
  ) {
    return this.instituts.desactiver(utilisateur, id, dto.motif, contexteRequete(req));
  }

  @Post(':id/activer')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réactiver un institut' })
  activer(@UtilisateurCourant() utilisateur: PayloadAcces, @Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.instituts.activer(utilisateur, id, contexteRequete(req));
  }
}
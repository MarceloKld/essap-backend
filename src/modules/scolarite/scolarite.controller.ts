import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InstitutCourant } from '../../common/decorators/institut-courant.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { contexteRequete } from '../../common/utils/contexte-requete.js';
import { AnneesScolairesService } from './annees-scolaires.service.js';
import { ClassesService } from './classes.service.js';
import { CreerAnneeDto } from './dto/creer-annee.dto.js';

const ENTETE_INSTITUT = {
  name: 'X-Institut-Id',
  required: false,
  description: 'Obligatoire pour un DG (plusieurs instituts) et le Super Admin. Ignoré pour SGAC et Administrateur du Budget.',
};

@ApiTags('Années scolaires')
@ApiBearerAuth()
@ApiHeader(ENTETE_INSTITUT)
@Controller('annees-scolaires')
export class AnneesScolairesController {
  constructor(private readonly annees: AnneesScolairesService) {}

  @Get()
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiOperation({ summary: "Années scolaires de l'institut (la plus récente d'abord)" })
  lister(@InstitutCourant() institutId: number) {
    return this.annees.lister(institutId);
  }

  // Cette route doit être AVANT toute route « :id ».
  @Get('active')
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiOperation({ summary: "L'année scolaire active" })
  active(@InstitutCourant() institutId: number) {
    return this.annees.active(institutId);
  }

  @Post()
  @Roles('DG', 'SGAC')
  @ApiOperation({ summary: 'Créer une année scolaire (option : l’activer tout de suite)' })
  creer(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Body() dto: CreerAnneeDto,
    @Req() req: Request,
  ) {
    return this.annees.creer(acteur, institutId, dto, contexteRequete(req));
  }

  @Post(':id/activer')
  @Roles('DG', 'SGAC')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activer une année (désactive la précédente)' })
  activer(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.annees.activer(acteur, institutId, id, contexteRequete(req));
  }

  @Post(':id/cloturer')
  @Roles('DG', 'SGAC')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clôturer une année (lecture seule définitive)' })
  cloturer(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.annees.cloturer(acteur, institutId, id, contexteRequete(req));
  }
}

@ApiTags('Classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiOperation({ summary: 'Classes disponibles (L1, L2, L3...)' })
  lister() {
    return this.classes.lister();
  }
}
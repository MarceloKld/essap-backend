import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InstitutCourant } from '../../common/decorators/institut-courant.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { contexteRequete } from '../../common/utils/contexte-requete.js';
import { AnneesScolairesService } from './annees-scolaires.service.js';
import { CreerAnneeDto } from './dto/creer-annee.dto.js';

@ApiTags('Années scolaires')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Institut-Id', required: false, description: 'Obligatoire pour un DG (plusieurs instituts) et le Super Admin.' })
@Controller('annees-scolaires')
export class AnneesScolairesController {
  constructor(private readonly annees: AnneesScolairesService) {}

  @Post()
  @Roles('SGAC', 'DG')
  @ApiOperation({ summary: 'Créer une année scolaire (inactive)' })
  creer(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Body() dto: CreerAnneeDto,
    @Req() req: Request,
  ) {
    return this.annees.creer(acteur, institutId, dto, contexteRequete(req));
  }

  @Get()
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiOperation({ summary: "Toutes les années scolaires de l'institut" })
  lister(@InstitutCourant() institutId: number) {
    return this.annees.lister(institutId);
  }

  @Get('active')
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiOperation({ summary: "L'année scolaire active" })
  active(@InstitutCourant() institutId: number) {
    return this.annees.active(institutId);
  }

  @Post(':id/activer')
  @Roles('SGAC', 'DG')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activer une année (désactive les autres)' })
  activer(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.annees.activer(acteur, institutId, id, contexteRequete(req));
  }

  @Post(':id/cloturer')
  @Roles('DG')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clôturer une année (lecture seule, irréversible par l\'API)' })
  cloturer(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.annees.cloturer(acteur, institutId, id, contexteRequete(req));
  }
}
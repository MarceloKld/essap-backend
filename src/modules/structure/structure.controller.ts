import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { InstitutCourant } from '../../common/decorators/institut-courant.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { contexteRequete } from '../../common/utils/contexte-requete.js';
import { CreerClasseDto, CreerDomaineDto, CreerFiliereDto, InitialiserStructureDto } from './dto/structure.dto.js';
import { StructureService } from './structure.service.js';

class FiltreClassesDto {
  @ApiPropertyOptional({ example: 'AP' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9-]{2,20}$/)
  filiereCode?: string;
}

/**
 * Lecture : DG, SGAC, Administrateur du Budget. Écriture : Super Admin SEULEMENT
 * (c'est lui qui configure les classes, domaines et filières de chaque institut).
 */
@ApiTags('Structure académique')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Institut-Id', required: false, description: 'Obligatoire pour le Super Admin et pour un DG ayant plusieurs instituts.' })
@Controller('structure')
export class StructureController {
  constructor(private readonly structure: StructureService) {}

  @Get()
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiOperation({ summary: "Domaines, filières et classes de l'institut" })
  arbre(@InstitutCourant() institutId: number) {
    return this.structure.arbre(institutId);
  }

  @Get('classes')
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiOperation({ summary: 'Liste à plat des classes (filtre optionnel par filière)' })
  classes(@InstitutCourant() institutId: number, @Query() filtre: FiltreClassesDto) {
    return this.structure.classes(institutId, filtre.filiereCode);
  }

  @Post('initialiser')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Démarrage rapide : un domaine, une filière et ses classes L1-L3 (et M1-M2)' })
  initialiser(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Body() dto: InitialiserStructureDto,
    @Req() req: Request,
  ) {
    return this.structure.initialiser(acteur, institutId, dto, contexteRequete(req));
  }

  @Post('domaines')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Ajouter un domaine' })
  creerDomaine(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Body() dto: CreerDomaineDto,
    @Req() req: Request,
  ) {
    return this.structure.creerDomaine(acteur, institutId, dto, contexteRequete(req));
  }

  @Post('filieres')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Ajouter une filière dans un domaine' })
  creerFiliere(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Body() dto: CreerFiliereDto,
    @Req() req: Request,
  ) {
    return this.structure.creerFiliere(acteur, institutId, dto, contexteRequete(req));
  }

  @Post('classes')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Ajouter une classe dans une filière (ex. M1, M2)' })
  creerClasse(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Body() dto: CreerClasseDto,
    @Req() req: Request,
  ) {
    return this.structure.creerClasse(acteur, institutId, dto, contexteRequete(req));
  }
}
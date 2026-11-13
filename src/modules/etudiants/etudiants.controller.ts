import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InstitutCourant } from '../../common/decorators/institut-courant.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { contexteRequete } from '../../common/utils/contexte-requete.js';
import { ChangerStatutDto } from './dto/changer-statut.dto.js';
import { ListerEtudiantsDto } from './dto/lister-etudiants.dto.js';
import { ModifierEtudiantDto } from './dto/modifier-etudiant.dto.js';
import { AjouterExistantDto, InscrireEtudiantDto, ReinscrireDto } from './dto/inscrire-etudiant.dto.js';
import { EtudiantsService } from './etudiants.service.js';
import { InscriptionsService } from './inscriptions.service.js';

/**
 * Lecture : DG, SGAC, Administrateur du Budget. Écriture : DG et SGAC.
 * Toutes les routes agissent sur l'INSTITUT COURANT (@InstitutCourant : vérifié, jamais falsifiable).
 */
@ApiTags('Étudiants')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Institut-Id', required: false, description: 'Obligatoire pour un DG (plusieurs instituts) et le Super Admin.' })
@Controller('etudiants')
export class EtudiantsController {
  constructor(
    private readonly etudiants: EtudiantsService,
    private readonly inscriptions: InscriptionsService,
  ) {}

  @Post()
  @Roles('DG', 'SGAC')
  @ApiOperation({ summary: 'Inscrire un NOUVEL étudiant (matricule généré, compte créé)' })
  inscrire(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Body() dto: InscrireEtudiantDto,
    @Req() req: Request,
  ) {
    return this.inscriptions.inscrire(acteur, institutId, dto, contexteRequete(req));
  }

  // Cette route doit être AVANT les routes « :id ».
  @Post('existants')
  @Roles('DG', 'SGAC')
  @ApiOperation({ summary: 'Ajouter un étudiant EXISTANT (sans frais d’inscription, ancien matricule conservable)' })
  ajouterExistant(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Body() dto: AjouterExistantDto,
    @Req() req: Request,
  ) {
    return this.inscriptions.ajouterExistant(acteur, institutId, dto, contexteRequete(req));
  }

  @Get()
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiOperation({ summary: 'Lister les étudiants (pagination, recherche, filtres année / classe / statut / sexe)' })
  lister(@InstitutCourant() institutId: number, @Query() filtres: ListerEtudiantsDto) {
    return this.etudiants.lister(institutId, filtres);
  }

  @Get(':id')
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiOperation({ summary: 'Fiche complète : identité, parcours année par année, compte' })
  detail(@InstitutCourant() institutId: number, @Param('id', ParseUUIDPipe) id: string) {
    return this.etudiants.detail(institutId, id);
  }

  @Patch(':id')
  @Roles('DG', 'SGAC')
  @ApiOperation({ summary: 'Modifier les informations (le matricule ne change jamais)' })
  modifier(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModifierEtudiantDto,
    @Req() req: Request,
  ) {
    return this.etudiants.modifier(acteur, institutId, id, dto, contexteRequete(req));
  }

  @Post(':id/reinscription')
  @Roles('DG', 'SGAC')
  @ApiOperation({ summary: 'Réinscrire (PASSAGE, REDOUBLEMENT ou REPRISE) : le matricule est conservé' })
  reinscrire(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReinscrireDto,
    @Req() req: Request,
  ) {
    return this.inscriptions.reinscrire(acteur, institutId, id, dto, contexteRequete(req));
  }

  @Post(':id/statut')
  @Roles('DG', 'SGAC')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Changer le statut (suspendu, parti, diplômé...) avec motif' })
  changerStatut(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangerStatutDto,
    @Req() req: Request,
  ) {
    return this.etudiants.changerStatut(acteur, institutId, id, dto, contexteRequete(req));
  }

  @Post(':id/compte/deverrouiller')
  @Roles('DG', 'SGAC')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déverrouiller le compte étudiant (après trop d’échecs de connexion)' })
  deverrouillerCompte(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.etudiants.deverrouillerCompte(acteur, institutId, id, contexteRequete(req));
  }
}
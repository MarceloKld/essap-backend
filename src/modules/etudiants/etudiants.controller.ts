import {
  Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { InstitutCourant } from '../../common/decorators/institut-courant.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { contexteRequete } from '../../common/utils/contexte-requete.js';
import { ChangerStatutDto } from './dto/changer-statut.dto.js';
import { FicheRemplieDto, FicheViergeDto } from './dto/fiche.dto.js';
import { AjouterExistantDto, InscrireEtudiantDto, MettreAJourPiecesDto, ReinscrireDto } from './dto/inscrire-etudiant.dto.js';
import { ListerEtudiantsDto } from './dto/lister-etudiants.dto.js';
import { ModifierEtudiantDto } from './dto/modifier-etudiant.dto.js';
import { EtudiantsService } from './etudiants.service.js';
import { FicheInscriptionService } from './fiche/fiche-inscription.service.js';
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
    private readonly fiches: FicheInscriptionService,
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

  // Les routes « fixes » (existants, fiche-inscription-vierge) doivent être AVANT les routes « :id ».
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

  @Get('fiche-inscription-vierge')
  @Roles('DG', 'SGAC')
  @Header('Cache-Control', 'no-store')
  @Throttle({ defaut: { limit: 30, ttl: 60_000 } }) // fabriquer un PDF coûte du processeur
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: "Fiche d'inscription VIERGE en PDF (à imprimer pour les candidats)" })
  async ficheVierge(@InstitutCourant() institutId: number, @Query() q: FicheViergeDto) {
    const { pdf, nomFichier } = await this.fiches.vierge(institutId, q.filiereCode, q.anneeId);
    return new StreamableFile(pdf, { type: 'application/pdf', disposition: `inline; filename="${nomFichier}"`, length: pdf.length });
  }

  @Get()
  @Roles('DG', 'SGAC', 'ADMIN_BUDGET')
  @ApiOperation({ summary: 'Lister les étudiants (pagination, recherche, filtres année / classe / filière / statut / sexe)' })
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

  @Put(':id/pieces')
  @Roles('DG', 'SGAC')
  @ApiOperation({ summary: 'Mettre à jour les pièces remises (section 4 de la fiche) et le « fait à »' })
  pieces(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MettreAJourPiecesDto,
    @Req() req: Request,
  ) {
    return this.inscriptions.mettreAJourPieces(acteur, institutId, id, dto, contexteRequete(req));
  }

  @Get(':id/fiche-inscription')
  @Roles('DG', 'SGAC')
  @Header('Cache-Control', 'no-store') // données personnelles : jamais en cache
  @Throttle({ defaut: { limit: 30, ttl: 60_000 } })
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: "Fiche d'inscription REMPLIE en PDF (générée à la volée, jamais stockée)" })
  async fiche(
    @UtilisateurCourant() acteur: PayloadAcces,
    @InstitutCourant() institutId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: FicheRemplieDto,
    @Req() req: Request,
  ) {
    const { pdf, nomFichier } = await this.fiches.remplie(acteur, institutId, id, q.anneeId, contexteRequete(req));
    return new StreamableFile(pdf, { type: 'application/pdf', disposition: `inline; filename="${nomFichier}"`, length: pdf.length });
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
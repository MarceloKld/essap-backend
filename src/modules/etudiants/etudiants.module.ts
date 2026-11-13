import { Module } from '@nestjs/common';
import { EtudiantsController } from './etudiants.controller.js';
import { EtudiantsService } from './etudiants.service.js';
import { InscriptionsService } from './inscriptions.service.js';
import { MatriculeService } from './matricule.service.js';

@Module({
  controllers: [EtudiantsController],
  providers: [EtudiantsService, InscriptionsService, MatriculeService],
})
export class EtudiantsModule {}
import { Module } from '@nestjs/common';
import { AnneesScolairesService } from './annees-scolaires.service.js';
import { ClassesService } from './classes.service.js';
import { AnneesScolairesController, ClassesController } from './scolarite.controller.js';

@Module({
  controllers: [AnneesScolairesController, ClassesController],
  providers: [AnneesScolairesService, ClassesService],
})
export class ScolariteModule {}
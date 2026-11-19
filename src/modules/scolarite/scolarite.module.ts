import { Module } from '@nestjs/common';
import { AnneesScolairesService } from './annees-scolaires.service.js';
import { AnneesScolairesController } from './scolarite.controller.js';

@Module({
  controllers: [AnneesScolairesController],
  providers: [AnneesScolairesService],
})
export class ScolariteModule {}
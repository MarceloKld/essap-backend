import { Module } from '@nestjs/common';
import { AnneesScolairesController } from './annees-scolaires.controller.js';
import { AnneesScolairesService } from './annees-scolaires.service.js';

@Module({
  controllers: [AnneesScolairesController],
  providers: [AnneesScolairesService],
})
export class AnneesScolairesModule {}
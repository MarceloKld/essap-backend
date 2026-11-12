import { Module } from '@nestjs/common';
import { SanteController } from './sante.controller.js';

/**
 * Un module Nest = une Â« boÃ®te Â» qui regroupe un domaine fonctionnel.
 * C'est la base de notre monolithe modulaire : un module par domaine
 * (auth, etudiants, paiements, deliberations...).
 */
@Module({
  controllers: [SanteController],
})
export class SanteModule {}
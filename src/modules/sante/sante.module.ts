import { Module } from '@nestjs/common';
import { SanteController } from './sante.controller';

/**
 * Un module Nest = une « boîte » qui regroupe un domaine fonctionnel.
 * C'est la base de notre monolithe modulaire : un module par domaine
 * (auth, etudiants, paiements, deliberations...).
 */
@Module({
  controllers: [SanteController],
})
export class SanteModule {}
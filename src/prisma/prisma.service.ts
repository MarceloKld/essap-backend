import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * PrismaService = le client Prisma, géré par Nest.
 *
 * - "extends PrismaClient" : le service HÉRITE de toutes les méthodes
 *   (this.etudiant.findMany(), this.paiement.create()...).
 * - L'adaptateur PrismaPg ouvre un pool de connexions vers PostgreSQL.
 * - OnModuleInit / OnModuleDestroy : on se connecte au démarrage de l'application,
 *   on se déconnecte proprement à l'arrêt.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
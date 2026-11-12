import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Configuration de la ligne de commande Prisma.
 * - schema     : un DOSSIER (on découpe le schéma en plusieurs fichiers lisibles)
 * - migrations : où ranger les fichiers SQL de migration
 * - seed       : la commande qui insère les données de départ
 * - datasource : l'URL de la base, lue dans le .env (jamais écrite en dur)
 */
export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
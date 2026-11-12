import 'dotenv/config';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * SEED DE DÉVELOPPEMENT : données FICTIVES pour donner vie à la base LOCALE.
 *
 * Deux garde-fous pour ne jamais polluer la production :
 *  1) refuse de tourner si NODE_ENV=production ;
 *  2) refuse de tourner si la base n'est pas sur cette machine (localhost).
 *
 * Il exécute dans l'ordre tous les fichiers prisma/dev/NN-*.ts. À chaque nouvelle
 * table, on ajoute simplement un fichier : rien d'autre à modifier.
 */
const urlBase = process.env.DATABASE_URL;
if (!urlBase) throw new Error('DATABASE_URL manquante dans le .env');

const hote = new URL(urlBase).hostname;
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(hote)) {
  console.error(`REFUSÉ : le seed de développement ne tourne que sur une base locale (hôte actuel : ${hote}).`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlBase }) });

async function main() {
  const dossier = join(process.cwd(), 'prisma', 'dev');
  const fichiers = readdirSync(dossier)
    .filter((f) => /^\d+.*\.ts$/.test(f)) // seulement 01-xxx.ts, 02-xxx.ts... (pas _commun.ts)
    .sort();

  console.log('Seed de développement (base locale) :');
  for (const fichier of fichiers) {
    const module = (await import(pathToFileURL(join(dossier, fichier)).href)) as {
      default: (client: PrismaClient) => Promise<void>;
    };
    await module.default(prisma);
  }
  console.log('Terminé.');
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
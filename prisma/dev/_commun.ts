import type { PrismaClient } from '../../src/generated/prisma/client.js';

export type Client = PrismaClient;

/** Mot de passe de TOUS les comptes de test. Réservé au développement local. */
export const MOT_DE_PASSE_DEV = 'Essap@Dev2026';
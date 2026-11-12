import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * SEED = données de référence communes à TOUS les instituts.
 * Les instituts eux-mêmes ne sont PAS ici : c'est le Super Admin qui les crée
 * depuis l'application, avec leurs autorités (DG, SGAC, Administrateur du Budget).
 *
 * IDEMPOTENT : on peut le relancer sans créer de doublons (upsert).
 */
const urlBase = process.env.DATABASE_URL;
if (!urlBase) throw new Error('DATABASE_URL manquante dans le .env');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlBase }) });

async function main() {
  // --- 1. Rôles ---
  const roles = [
    { code: 'SUPER_ADMIN', libelle: 'Super Admin' },
    { code: 'DG', libelle: 'Directeur Général' },
    { code: 'SGAC', libelle: 'Secrétaire Général Académique' },
    { code: 'ADMIN_BUDGET', libelle: 'Administrateur du Budget' },
    { code: 'ETUDIANT', libelle: 'Étudiant' },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { code: r.code }, update: { libelle: r.libelle }, create: r });
  }

  // --- 2. Classes : M1 et M2 s'ajouteront plus tard par une simple ligne ---
  const classes = [
    { code: 'L1', libelle: 'Licence 1', ordre: 1 },
    { code: 'L2', libelle: 'Licence 2', ordre: 2 },
    { code: 'L3', libelle: 'Licence 3', ordre: 3 },
  ];
  for (const c of classes) {
    await prisma.classe.upsert({ where: { code: c.code }, update: { libelle: c.libelle }, create: c });
  }

  // --- 3. Catégories de frais ---
  const categories = [
    { code: 'INSCRIPTION', libelle: "Frais d'inscription", nature: 'ACADEMIQUE' },
    { code: 'REINSCRIPTION', libelle: 'Frais de réinscription', nature: 'ACADEMIQUE' },
    { code: 'MINERVAL', libelle: 'Minerval / Scolarité', nature: 'ACADEMIQUE' },
    { code: 'STAGE', libelle: 'Frais de stage', nature: 'ACADEMIQUE' },
    { code: 'TFC', libelle: 'Travail de fin de cycle (TFC)', nature: 'ACADEMIQUE' },
    { code: 'LABO', libelle: 'Laboratoire', nature: 'ANNEXE' },
    { code: 'INTERNET', libelle: 'Internet', nature: 'ANNEXE' },
    { code: 'CARTE', libelle: "Carte d'étudiant", nature: 'ANNEXE' },
  ] as const;
  for (const c of categories) {
    await prisma.categorieFrais.upsert({
      where: { code: c.code },
      update: { libelle: c.libelle, nature: c.nature },
      create: c,
    });
  }

  console.log('Seed terminé : rôles, classes et catégories de frais.');
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
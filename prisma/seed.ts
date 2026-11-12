import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * SEED = données de départ, indispensables au fonctionnement du logiciel.
 * Il est IDEMPOTENT : on peut le lancer 10 fois, il ne crée pas de doublons,
 * car on utilise "upsert" (= mettre à jour si ça existe, sinon créer).
 */
const urlBase = process.env.DATABASE_URL;
if (!urlBase) throw new Error('DATABASE_URL manquante dans le .env');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlBase }) });

async function main() {
  // --- 1. Rôles (validés par Marcelo) ---
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

  // --- 2. Extension principale (le siège) ---
  await prisma.extension.upsert({
    where: { code: 'ESSAP-SIEGE' },
    update: {},
    create: {
      code: 'ESSAP-SIEGE',
      nom: 'ESSAP – Siège',
      adresse: 'N° 07, entre Kasa-Vubu et Éthiopie (réf. : collège des Érudits)',
      telephone: '+243 898 997 266',
      email: 'kalonji905@gmail.com',
      estPrincipale: true,
    },
  });

  // --- 3. Classes : L1, L2, L3 (M1 et M2 s'ajouteront plus tard par une ligne) ---
  const classes = [
    { code: 'L1', libelle: 'Licence 1', ordre: 1 },
    { code: 'L2', libelle: 'Licence 2', ordre: 2 },
    { code: 'L3', libelle: 'Licence 3', ordre: 3 },
  ];
  for (const c of classes) {
    await prisma.classe.upsert({ where: { code: c.code }, update: { libelle: c.libelle }, create: c });
  }

  // --- 4. Catégories de frais ---
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

  // --- 5. Année scolaire en cours (dates PROVISOIRES : à corriger avec les vraies dates) ---
  await prisma.anneeScolaire.upsert({
    where: { libelle: '2026-2027' },
    update: {},
    create: {
      libelle: '2026-2027',
      dateDebut: new Date('2026-10-01'),
      dateFin: new Date('2027-07-31'),
      estActive: true,
    },
  });

  // --- 6. Paramètres : format du matricule (ex. ESSAP2026L10001) ---
  await prisma.parametre.upsert({
    where: { cle: 'matricule.format' },
    update: {},
    create: {
      cle: 'matricule.format',
      valeur: { prefixe: 'ESSAP', longueurSequence: 5 },
      description: 'Préfixe + année + classe + numéro de séquence',
    },
  });

  console.log('Seed terminé.');
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
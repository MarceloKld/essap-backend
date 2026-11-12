import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { REGEX_NOM_UTILISATEUR, normaliserTelephone } from '../src/common/utils/identifiants.js';
import { hacherMotDePasse } from '../src/common/utils/mot-de-passe.js';

/**
 * Crée LE PREMIER Super Admin (à lancer une seule fois par base).
 * Les valeurs viennent de variables d'environnement, jamais du code :
 *   SUPER_ADMIN_UTILISATEUR, SUPER_ADMIN_MOT_DE_PASSE (obligatoires)
 *   SUPER_ADMIN_NOM, SUPER_ADMIN_EMAIL, SUPER_ADMIN_TELEPHONE (facultatives)
 */
const urlBase = process.env.DATABASE_URL;
if (!urlBase) throw new Error('DATABASE_URL manquante.');

const nomUtilisateur = (process.env.SUPER_ADMIN_UTILISATEUR ?? '').trim().toLowerCase();
const motDePasse = process.env.SUPER_ADMIN_MOT_DE_PASSE ?? '';
const nom = (process.env.SUPER_ADMIN_NOM ?? 'Super Admin').trim();
const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || null;
const telephone = process.env.SUPER_ADMIN_TELEPHONE ? normaliserTelephone(process.env.SUPER_ADMIN_TELEPHONE) : null;

if (!REGEX_NOM_UTILISATEUR.test(nomUtilisateur)) {
  throw new Error("SUPER_ADMIN_UTILISATEUR invalide (3 à 50 caractères : lettre au début, minuscules, chiffres, . _ -).");
}
if (motDePasse.length < 12 || !/[A-Za-z]/.test(motDePasse) || !/\d/.test(motDePasse)) {
  throw new Error('SUPER_ADMIN_MOT_DE_PASSE : 12 caractères minimum, avec au moins une lettre et un chiffre.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlBase }) });

async function main() {
  const role = await prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' } });
  if (!role) throw new Error("Rôles absents : lance d'abord « npm run db:seed ».");

  const existant = await prisma.utilisateur.findFirst({ where: { roleId: role.id, supprimeLe: null } });
  if (existant) {
    console.log(`Un Super Admin existe déjà (« ${existant.nomUtilisateur} ») : rien n'a été créé.`);
    return;
  }

  await prisma.utilisateur.create({
    data: {
      nomUtilisateur,
      email,
      telephone,
      nom,
      roleId: role.id,
      motDePasseHache: await hacherMotDePasse(motDePasse),
      doitChangerMotDePasse: false,
    },
  });
  console.log(`Super Admin « ${nomUtilisateur} » créé.`);
}

main()
  .catch((erreur) => {
    console.error(String(erreur instanceof Error ? erreur.message : erreur));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
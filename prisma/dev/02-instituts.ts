import { hacherMotDePasse } from '../../src/common/utils/mot-de-passe.js';
import { MOT_DE_PASSE_DEV, type Client } from './_commun.js';

/**
 * Étape B4 : un SECOND institut fictif (DEMO-B). Le DG de démo a accès aux DEUX instituts,
 * le SGAC et l'Administrateur du Budget de DEMO-B ne voient QUE DEMO-B.
 */
export default async function peuplerInstituts(prisma: Client): Promise<void> {
  const hash = await hacherMotDePasse(MOT_DE_PASSE_DEV);

  const institut = await prisma.institut.upsert({
    where: { code: 'DEMO-B' },
    update: {},
    create: {
      code: 'DEMO-B',
      nom: 'Institut Démo B (extension fictive)',
      sigle: 'DEMOB',
      adresse: 'Autre adresse fictive',
    },
  });

  await prisma.anneeScolaire.upsert({
    where: { institutId_libelle: { institutId: institut.id, libelle: '2026-2027' } },
    update: {},
    create: {
      institutId: institut.id,
      libelle: '2026-2027',
      dateDebut: new Date('2026-10-01'),
      dateFin: new Date('2027-07-31'),
      estActive: true,
    },
  });

  await prisma.parametre.upsert({
    where: { institutId_cle: { institutId: institut.id, cle: 'matricule.format' } },
    update: {},
    create: {
      institutId: institut.id,
      cle: 'matricule.format',
      valeur: { prefixe: 'DMOB', longueurSequence: 4 },
      description: 'Préfixe + année + classe + numéro de séquence',
    },
  });

  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.code, r.id]));
  const personnel = [
    { nomUtilisateur: 'sgac.demob', role: 'SGAC', nom: 'Lukusa', prenom: 'Marie', tel: '+243800000005' },
    { nomUtilisateur: 'budget.demob', role: 'ADMIN_BUDGET', nom: 'Mwanza', prenom: 'Paul', tel: '+243800000006' },
  ];
  for (const p of personnel) {
    await prisma.utilisateur.upsert({
      where: { nomUtilisateur: p.nomUtilisateur },
      update: {},
      create: {
        nomUtilisateur: p.nomUtilisateur,
        email: `${p.nomUtilisateur}@essap.test`,
        telephone: p.tel,
        motDePasseHache: hash,
        nom: p.nom,
        prenom: p.prenom,
        roleId: roles[p.role],
        institutId: institut.id,
        doitChangerMotDePasse: false,
      },
    });
  }

  // Le DG de démo gère maintenant les DEUX instituts.
  const dg = await prisma.utilisateur.findUnique({ where: { nomUtilisateur: 'dg.demo' } });
  if (!dg) throw new Error("dg.demo introuvable : lance d'abord le fichier 01-acces (npm run db:peupler).");
  await prisma.accesInstitut.upsert({
    where: { utilisateurId_institutId: { utilisateurId: dg.id, institutId: institut.id } },
    update: {},
    create: { utilisateurId: dg.id, institutId: institut.id },
  });

  // Deux étudiants fictifs pour DEMO-B
  const etudiants = [
    { matricule: 'DB26L101', nom: 'Kasongo', postnom: 'Banza', prenom: 'Alain', sexe: 'M', naissance: '2003-05-12' },
    { matricule: 'DB26L102', nom: 'Nsimba', postnom: 'Lutete', prenom: 'Clarisse', sexe: 'F', naissance: '2004-12-01' },
  ] as const;
  for (const e of etudiants) {
    const etudiant = await prisma.etudiant.upsert({
      where: { matricule: e.matricule },
      update: {},
      create: {
        institutId: institut.id,
        matricule: e.matricule,
        nom: e.nom,
        postnom: e.postnom,
        prenom: e.prenom,
        sexe: e.sexe,
        dateNaissance: new Date(e.naissance),
        statut: 'INSCRIT',
      },
    });
    await prisma.compteEtudiant.upsert({
      where: { etudiantId: etudiant.id },
      update: {},
      create: { etudiantId: etudiant.id },
    });
  }

  console.log('  ✔ Instituts : DEMO-B (SGAC, Budget, 2 étudiants) ; dg.demo a accès à DEMO-LOCAL et DEMO-B.');
}
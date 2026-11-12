import { hacherMotDePasse } from '../../src/common/utils/mot-de-passe.js';
import { MOT_DE_PASSE_DEV, type Client } from './_commun.js';

/**
 * Étape B3 : un institut démo, des comptes de personnel, des étudiants avec compte.
 * Idempotent (upsert) : on peut relancer sans créer de doublons.
 */
export default async function peuplerAcces(prisma: Client): Promise<void> {
  const hash = await hacherMotDePasse(MOT_DE_PASSE_DEV); // calculé une fois, réutilisé pour tous

  // --- Institut démo + son année + son format de matricule ---
  const institut = await prisma.institut.upsert({
    where: { code: 'DEMO-LOCAL' },
    update: {},
    create: {
      code: 'DEMO-LOCAL',
      nom: 'Institut Démo (données fictives locales)',
      sigle: 'DEMO',
      adresse: 'Adresse fictive',
      estPrincipal: true,
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
      valeur: { prefixe: 'DEMO', longueurSequence: 5 },
      description: 'Préfixe + année + classe + numéro de séquence',
    },
  });

  // --- Personnel ---
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.code, r.id]));
  if (!roles['SUPER_ADMIN']) throw new Error("Rôles absents : lance d'abord « npm run db:seed ».");

  const personnel = [
    { nomUtilisateur: 'superadmin', role: 'SUPER_ADMIN', institut: null, nom: 'Super', prenom: 'Admin', tel: '+243800000001', mdpTemporaire: false },
    { nomUtilisateur: 'dg.demo', role: 'DG', institut: null, nom: 'Mutombo', prenom: 'Joseph', tel: '+243800000002', mdpTemporaire: false },
    { nomUtilisateur: 'sgac.demo', role: 'SGAC', institut: institut.id, nom: 'Kabongo', prenom: 'Esther', tel: '+243800000003', mdpTemporaire: true },
    { nomUtilisateur: 'budget.demo', role: 'ADMIN_BUDGET', institut: institut.id, nom: 'Ilunga', prenom: 'David', tel: '+243800000004', mdpTemporaire: false },
  ];

  for (const p of personnel) {
    const utilisateur = await prisma.utilisateur.upsert({
      where: { nomUtilisateur: p.nomUtilisateur },
      update: {},
      create: {
        nomUtilisateur: p.nomUtilisateur,
        email: `${p.nomUtilisateur}@essap.test`, // ".test" = domaine réservé, jamais un vrai email
        telephone: p.tel,
        motDePasseHache: hash,
        nom: p.nom,
        prenom: p.prenom,
        roleId: roles[p.role],
        institutId: p.institut,
        doitChangerMotDePasse: p.mdpTemporaire, // sgac.demo : pour tester la modale de 1re connexion
      },
    });

    // Le DG a accès à l'institut démo (et à d'autres plus tard) via acces_instituts.
    if (p.role === 'DG') {
      await prisma.accesInstitut.upsert({
        where: { utilisateurId_institutId: { utilisateurId: utilisateur.id, institutId: institut.id } },
        update: {},
        create: { utilisateurId: utilisateur.id, institutId: institut.id },
      });
    }
  }

  // --- Étudiants fictifs, chacun avec son compte (connexion = matricule + date de naissance) ---
  const etudiants = [
    { matricule: 'DEMO2026L10001', nom: 'Mukendi', postnom: 'Kabeya', prenom: 'Grace', sexe: 'F', naissance: '2004-03-15' },
    { matricule: 'DEMO2026L10002', nom: 'Tshibangu', postnom: 'Ngoy', prenom: 'Patrick', sexe: 'M', naissance: '2003-11-02' },
    { matricule: 'DEMO2026L10003', nom: 'Banza', postnom: 'Mwamba', prenom: 'Sarah', sexe: 'F', naissance: '2005-07-21' },
    { matricule: 'DEMO2026L20001', nom: 'Kalala', postnom: 'Ilunga', prenom: 'Jonathan', sexe: 'M', naissance: '2002-01-30' },
    { matricule: 'DEMO2026L30001', nom: 'Mbuyi', postnom: 'Tshimanga', prenom: 'Ruth', sexe: 'F', naissance: '2001-09-09' },
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

  console.log('  ✔ Accès : 4 comptes de personnel, 5 étudiants.');
  console.log('    Mot de passe de test (personnel) :', MOT_DE_PASSE_DEV);
  console.log('    Étudiant : DEMO2026L10001 + 2004-03-15');
}
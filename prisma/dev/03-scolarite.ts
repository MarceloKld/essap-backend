import { formaterMatricule, lireFormatMatricule } from '../../src/common/utils/matricule.js';
import type { Client } from './_commun.js';

const NOMS = ['Kabasele', 'Lukusa', 'Mbuyi', 'Kalala', 'Ilunga', 'Mutombo', 'Kabeya', 'Nsimba', 'Banza', 'Kapinga', 'Tshimanga', 'Mulumba', 'Nkulu', 'Mwamba'];
const POSTNOMS = ['Ngoy', 'Kasongo', 'Tshibangu', 'Mwanza', 'Lutete', 'Kayembe', 'Numbi'];
const PRENOMS_F = ['Esther', 'Rachel', 'Divine', 'Clarisse', 'Sarah', 'Ruth', 'Joëlle'];
const PRENOMS_M = ['Patrick', 'Jonathan', 'David', 'Christian', 'Samuel', 'Alain', 'Joseph'];
const NIVEAUX = [
  { code: 'L1', libelle: 'Licence 1', ordre: 1 },
  { code: 'L2', libelle: 'Licence 2', ordre: 2 },
  { code: 'L3', libelle: 'Licence 3', ordre: 3 },
];

// Le matricule ne contient plus la classe : on la note ici pour les étudiants créés par les fichiers 01 et 02.
const CLASSE_DES_ETUDIANTS_DE_DEMO: Record<string, string> = {
  DM260001: 'L1', DM260002: 'L1', DM260003: 'L1', DM260004: 'L2', DM260005: 'L3',
  DB260001: 'L1', DB260002: 'L1',
};

/**
 * Étape B5a : structure académique (domaine, filière, classes), inscriptions des étudiants de démo,
 * compteur de matricules, 14 étudiants fictifs. Idempotent : les matricules fictifs sont FIXES.
 */
export default async function peuplerScolarite(prisma: Client): Promise<void> {
  let crees = 0;

  for (const codeInstitut of ['DEMO-LOCAL', 'DEMO-B']) {
    const institut = await prisma.institut.findUnique({ where: { code: codeInstitut } });
    if (!institut) continue;

    // 1) Structure académique de l'institut : Sciences de la santé > Assistance en pharmacie > L1, L2, L3
    const domaine = await prisma.domaine.upsert({
      where: { institutId_code: { institutId: institut.id, code: 'SS' } },
      update: {},
      create: { institutId: institut.id, code: 'SS', libelle: 'Sciences de la santé' },
    });
    const filiere = await prisma.filiere.upsert({
      where: { institutId_code: { institutId: institut.id, code: 'AP' } },
      update: {},
      create: { institutId: institut.id, domaineId: domaine.id, code: 'AP', libelle: 'Assistance en pharmacie' },
    });
    const classeIds = new Map<string, number>();
    for (const n of NIVEAUX) {
      const classe = await prisma.classe.upsert({
        where: { filiereId_code: { filiereId: filiere.id, code: n.code } },
        update: {},
        create: { institutId: institut.id, filiereId: filiere.id, code: n.code, libelle: n.libelle, ordre: n.ordre },
      });
      classeIds.set(n.code, classe.id);
    }

    // 2) Année active et format de matricule
    const annee = await prisma.anneeScolaire.findFirst({ where: { institutId: institut.id, estActive: true } });
    const parametre = await prisma.parametre.findUnique({
      where: { institutId_cle: { institutId: institut.id, cle: 'matricule.format' } },
    });
    const format = parametre ? lireFormatMatricule(parametre.valeur) : null;
    if (!annee || !format) continue;
    const debut = format.prefixe + annee.libelle.slice(2, 4); // ex. « DM26 »
    let maxNumero = 0;

    const inscrire = async (etudiantId: string, classeId: number) => {
      await prisma.inscription.upsert({
        where: { etudiantId_anneeId: { etudiantId, anneeId: annee.id } },
        update: {},
        create: {
          etudiantId, anneeId: annee.id, classeId, institutId: institut.id, type: 'INSCRIPTION',
          piecesFournies: ['DIPLOME', 'IDENTITE', 'PHOTOS'], faitA: 'Kinshasa',
        },
      });
      await prisma.statutAnnuel.upsert({
        where: { etudiantId_anneeId: { etudiantId, anneeId: annee.id } },
        update: {},
        create: { etudiantId, anneeId: annee.id, etat: 'INSCRIT' },
      });
    };

    // 3) Les étudiants créés par les fichiers 01 et 02
    const existants = await prisma.etudiant.findMany({
      where: { institutId: institut.id, matricule: { startsWith: debut } },
    });
    for (const e of existants) {
      const codeClasse = e.matricule ? CLASSE_DES_ETUDIANTS_DE_DEMO[e.matricule] : undefined;
      const classeId = codeClasse ? classeIds.get(codeClasse) : undefined;
      if (!e.matricule || !classeId) continue;
      await inscrire(e.id, classeId);
      maxNumero = Math.max(maxNumero, Number(e.matricule.slice(debut.length)));
    }

    if (codeInstitut === 'DEMO-LOCAL') {
      // Un dossier complet pour tester la fiche PDF
      await prisma.etudiant.updateMany({
        where: { matricule: 'DM260001' },
        data: {
          etatCivil: 'CELIBATAIRE', lieuNaissance: 'Kinshasa', nationalite: 'Congolaise', telephone: '+243800000101',
          adresse: 'Selembao', contactUrgenceNom: 'Mukendi Pierre', contactUrgenceTelephone: '+243800000102',
          dernierDiplome: "Diplôme d'État", anneeObtention: 2022, etablissementOrigine: 'Lycée de démonstration',
          villePaysOrigine: 'Kinshasa / RDC',
        },
      });

      // 4) 14 étudiants fictifs : numéros 6 à 19 (après ceux des fichiers 01)
      const plan = [{ code: 'L1', combien: 8 }, { code: 'L2', combien: 4 }, { code: 'L3', combien: 2 }];
      let numero = 6;
      let i = 0;
      for (const { code, combien } of plan) {
        const classeId = classeIds.get(code);
        if (!classeId) continue;
        for (let k = 0; k < combien; k++, numero++, i++) {
          const matricule = formaterMatricule(format, annee.libelle, numero);
          const sexe = i % 2 === 0 ? 'F' : 'M';
          const prenoms = sexe === 'F' ? PRENOMS_F : PRENOMS_M;
          const etudiant = await prisma.etudiant.upsert({
            where: { matricule },
            update: {},
            create: {
              institutId: institut.id, matricule,
              nom: NOMS[i % NOMS.length], postnom: POSTNOMS[(i * 3) % POSTNOMS.length], prenom: prenoms[(i * 5) % prenoms.length],
              sexe, dateNaissance: new Date(Date.UTC(2000 + (i % 6), (i * 5) % 12, 1 + ((i * 3) % 27))),
              etatCivil: 'CELIBATAIRE', statut: 'INSCRIT',
            },
          });
          await prisma.compteEtudiant.upsert({ where: { etudiantId: etudiant.id }, update: {}, create: { etudiantId: etudiant.id } });
          await inscrire(etudiant.id, classeId);
          maxNumero = Math.max(maxNumero, numero);
          crees++;
        }
      }
    }

    // 5) Compteur de matricules : le prochain numéro généré par l'API ne peut pas tomber sur un existant
    const cle = { institutId: institut.id, anneeId: annee.id };
    const sequence = await prisma.sequenceMatricule.findUnique({ where: { institutId_anneeId: cle } });
    if (!sequence) await prisma.sequenceMatricule.create({ data: { ...cle, dernierNumero: maxNumero } });
    else if (sequence.dernierNumero < maxNumero) {
      await prisma.sequenceMatricule.update({ where: { id: sequence.id }, data: { dernierNumero: maxNumero } });
    }
  }
  console.log(`  ✔ Scolarité : structure, inscriptions de démo, ${crees} étudiants fictifs, compteurs de matricules.`);
}
import { formaterMatricule, lireFormatMatricule } from '../../src/common/utils/matricule.js';
import type { Client } from './_commun.js';

const NOMS = ['Kabasele', 'Lukusa', 'Mbuyi', 'Kalala', 'Ilunga', 'Mutombo', 'Kabeya', 'Nsimba', 'Banza', 'Kapinga', 'Tshimanga', 'Mulumba', 'Nkulu', 'Mwamba'];
const POSTNOMS = ['Ngoy', 'Kasongo', 'Tshibangu', 'Mwanza', 'Lutete', 'Kayembe', 'Numbi'];
const PRENOMS_F = ['Esther', 'Rachel', 'Divine', 'Clarisse', 'Sarah', 'Ruth', 'Joëlle'];
const PRENOMS_M = ['Patrick', 'Jonathan', 'David', 'Christian', 'Samuel', 'Alain', 'Joseph'];

/**
 * Étape B5 : inscriptions des étudiants de démo, compteurs de matricules, 14 étudiants fictifs.
 * Idempotent : les matricules des étudiants fictifs sont FIXES, donc rien ne se duplique.
 */
export default async function peuplerScolarite(prisma: Client): Promise<void> {
  const classes = await prisma.classe.findMany({ where: { code: { in: ['L1', 'L2', 'L3'] } } });
  const classeParCode = new Map(classes.map((c) => [c.code, c]));
  let crees = 0;

  for (const codeInstitut of ['DEMO-LOCAL', 'DEMO-B']) {
    const institut = await prisma.institut.findUnique({ where: { code: codeInstitut } });
    if (!institut) continue;
    const annee = await prisma.anneeScolaire.findFirst({ where: { institutId: institut.id, estActive: true } });
    const parametre = await prisma.parametre.findUnique({
      where: { institutId_cle: { institutId: institut.id, cle: 'matricule.format' } },
    });
    const format = parametre ? lireFormatMatricule(parametre.valeur) : null;
    if (!annee || !format) continue;

    const maxParClasse = new Map<string, number>();
    const noter = (codeClasse: string, numero: number) =>
      maxParClasse.set(codeClasse, Math.max(maxParClasse.get(codeClasse) ?? 0, numero));

    const inscrire = async (etudiantId: string, classeId: number) => {
      await prisma.inscription.upsert({
        where: { etudiantId_anneeId: { etudiantId, anneeId: annee.id } },
        update: {},
        create: { etudiantId, anneeId: annee.id, classeId, institutId: institut.id, type: 'INSCRIPTION' },
      });
      await prisma.statutAnnuel.upsert({
        where: { etudiantId_anneeId: { etudiantId, anneeId: annee.id } },
        update: {},
        create: { etudiantId, anneeId: annee.id, etat: 'INSCRIT' },
      });
    };

    // 1) Les étudiants créés par les fichiers 01 et 02 (la classe se lit dans leur matricule : ES26L101 -> L1, n° 01)
    const existants = await prisma.etudiant.findMany({ where: { institutId: institut.id, matricule: { not: null } } });
    for (const e of existants) {
      const matricule = e.matricule as string;
      if (!matricule.startsWith(format.prefixe)) continue;
      const reste = matricule.slice(format.prefixe.length); // ex. « 26L101 »
      const classe = classeParCode.get(reste.slice(2, 4));
      const numero = Number(reste.slice(4));
      if (!classe || Number.isNaN(numero)) continue;
      await inscrire(e.id, classe.id);
      noter(classe.code, numero);
    }

    // 2) 14 étudiants fictifs, uniquement dans l'institut démo principal (numéros fixes, après ceux de 01)
    if (codeInstitut === 'DEMO-LOCAL') {
      const plan: Array<{ code: string; depart: number; combien: number }> = [
        { code: 'L1', depart: 4, combien: 8 },
        { code: 'L2', depart: 2, combien: 4 },
        { code: 'L3', depart: 2, combien: 2 },
      ];
      let i = 0;
      for (const { code, depart, combien } of plan) {
        const classe = classeParCode.get(code);
        if (!classe) continue;
        for (let k = 0; k < combien; k++, i++) {
          const numero = depart + k;
          const matricule = formaterMatricule(format, annee.libelle, code, numero);
          const sexe = i % 2 === 0 ? 'F' : 'M';
          const prenoms = sexe === 'F' ? PRENOMS_F : PRENOMS_M;
          const etudiant = await prisma.etudiant.upsert({
            where: { matricule },
            update: {},
            create: {
              institutId: institut.id,
              matricule,
              nom: NOMS[i % NOMS.length],
              postnom: POSTNOMS[(i * 3) % POSTNOMS.length],
              prenom: prenoms[(i * 5) % prenoms.length],
              sexe,
              dateNaissance: new Date(Date.UTC(2000 + (i % 6), (i * 5) % 12, 1 + ((i * 3) % 27))),
              statut: 'INSCRIT',
            },
          });
          await prisma.compteEtudiant.upsert({ where: { etudiantId: etudiant.id }, update: {}, create: { etudiantId: etudiant.id } });
          await inscrire(etudiant.id, classe.id);
          noter(code, numero);
          crees++;
        }
      }
    }

    // 3) Compteurs de matricules : le prochain matricule généré par l'API ne peut pas tomber sur un existant
    for (const [codeClasse, max] of maxParClasse) {
      const classe = classeParCode.get(codeClasse);
      if (!classe) continue;
      const cle = { institutId: institut.id, anneeId: annee.id, classeId: classe.id };
      const sequence = await prisma.sequenceMatricule.findUnique({ where: { institutId_anneeId_classeId: cle } });
      if (!sequence) await prisma.sequenceMatricule.create({ data: { ...cle, dernierNumero: max } });
      else if (sequence.dernierNumero < max) {
        await prisma.sequenceMatricule.update({ where: { id: sequence.id }, data: { dernierNumero: max } });
      }
    }
  }
  console.log(`  ✔ Scolarité : étudiants de démo inscrits, ${crees} étudiants fictifs, compteurs de matricules.`);
}
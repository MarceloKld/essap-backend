import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { formaterMatricule, lireFormatMatricule } from '../../common/utils/matricule.js';

/**
 * Génère les matricules : ES260015 = préfixe + année + numéro.
 * Une SEULE requête SQL incrémente le compteur et renvoie le nouveau numéro :
 *  - « INSERT ... ON CONFLICT DO UPDATE » crée le compteur s'il n'existe pas, sinon l'augmente de 1 ;
 *  - la base VERROUILLE la ligne jusqu'à la fin de la transaction : deux secrétaires qui inscrivent
 *    en même temps reçoivent forcément deux numéros différents ;
 *  - si l'inscription échoue, la transaction est annulée et le compteur revient en arrière (pas de trou).
 */
@Injectable()
export class MatriculeService {
  async suivant(tx: Prisma.TransactionClient, institutId: number, annee: { id: number; libelle: string }): Promise<string> {
    const parametre = await tx.parametre.findUnique({ where: { institutId_cle: { institutId, cle: 'matricule.format' } } });
    const format = parametre ? lireFormatMatricule(parametre.valeur) : null;
    if (!format) throw new ConflictException("Le format de matricule de cet institut n'est pas configuré.");

    // Plusieurs essais : un ancien matricule saisi à la main (étudiant existant) peut déjà occuper le prochain numéro.
    for (let essai = 0; essai < 50; essai++) {
      const lignes = await tx.$queryRaw<Array<{ dernier_numero: number }>>`
        INSERT INTO sequences_matricule (institut_id, annee_id, dernier_numero)
        VALUES (${institutId}, ${annee.id}, 1)
        ON CONFLICT (institut_id, annee_id)
        DO UPDATE SET dernier_numero = sequences_matricule.dernier_numero + 1
        RETURNING dernier_numero`;
      const matricule = formaterMatricule(format, annee.libelle, Number(lignes[0].dernier_numero));
      const pris = await tx.etudiant.findUnique({ where: { matricule }, select: { id: true } });
      if (!pris) return matricule;
    }
    throw new ConflictException('Impossible de générer un matricule libre. Contactez le support.');
  }
}
import { PartialType } from '@nestjs/swagger';
import { IdentiteEtudiantDto } from './identite-etudiant.dto.js';

/** Tous les champs d'identité, tous facultatifs. Le matricule n'est JAMAIS modifiable. */
export class ModifierEtudiantDto extends PartialType(IdentiteEtudiantDto) {}
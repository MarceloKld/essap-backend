import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { IdentiteEtudiantDto } from './identite-etudiant.dto.js';

const majuscules = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class InscrireEtudiantDto extends IdentiteEtudiantDto {
  @ApiProperty({ example: 'L1', description: 'Code de la classe (voir GET /classes)' })
  @Transform(majuscules)
  @Matches(/^[A-Z][A-Z0-9]{0,4}$/, { message: 'Code de classe invalide.' })
  classeCode!: string;

  @ApiPropertyOptional({ description: "Année scolaire visée (par défaut : l'année active)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  anneeId?: number;

  @ApiPropertyOptional({ description: 'Forcer la création malgré un doublon détecté (autre personne de même identité)' })
  @IsOptional()
  @IsBoolean()
  ignorerDoublon?: boolean;
}

/** Étudiant déjà connu (repris avec son historique) : sans frais d'inscription, avec son ancien matricule s'il en a un. */
export class AjouterExistantDto extends InscrireEtudiantDto {
  @ApiPropertyOptional({ example: 'ES24L112', description: "Ancien matricule à conserver. S'il est absent, un nouveau est généré." })
  @IsOptional()
  @Transform(majuscules)
  @Matches(/^[A-Z0-9-]{5,30}$/, { message: 'Matricule invalide (5 à 30 caractères : A-Z, 0-9, tiret).' })
  matricule?: string;
}

export const DECISIONS = ['PASSAGE', 'REDOUBLEMENT', 'REPRISE'] as const;

export class ReinscrireDto {
  @ApiProperty({ enum: DECISIONS })
  @IsIn(DECISIONS)
  decision!: 'PASSAGE' | 'REDOUBLEMENT' | 'REPRISE';

  @ApiPropertyOptional({ description: 'Obligatoire pour une REPRISE. Pour PASSAGE et REDOUBLEMENT, la classe est déduite.' })
  @IsOptional()
  @Transform(majuscules)
  @Matches(/^[A-Z][A-Z0-9]{0,4}$/, { message: 'Code de classe invalide.' })
  classeCode?: string;

  @ApiPropertyOptional({ description: "Année scolaire visée (par défaut : l'année active)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  anneeId?: number;
}
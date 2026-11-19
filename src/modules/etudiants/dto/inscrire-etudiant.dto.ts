import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { PIECES_DOSSIER } from '../pieces.js';
import { IdentiteEtudiantDto } from './identite-etudiant.dto.js';

const majuscules = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class InscrireEtudiantDto extends IdentiteEtudiantDto {
  @ApiProperty({ example: 'L1', description: 'Code de la classe (voir GET /structure/classes)' })
  @Transform(majuscules)
  @Matches(/^[A-Z][A-Z0-9]{0,4}$/, { message: 'Code de classe invalide.' })
  classeCode!: string;

  @ApiPropertyOptional({ example: 'AP', description: 'Obligatoire seulement si plusieurs filières ont une classe du même code' })
  @IsOptional()
  @Transform(majuscules)
  @Matches(/^[A-Z0-9-]{2,20}$/, { message: 'Code de filière invalide.' })
  filiereCode?: string;

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

  @ApiPropertyOptional({ enum: PIECES_DOSSIER, isArray: true, description: 'Pièces remises (section 4 de la fiche)' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PIECES_DOSSIER, { each: true })
  piecesFournies?: string[];

  @ApiPropertyOptional({ example: 'Kinshasa', description: '« Fait à » en bas de la fiche' })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(100)
  faitA?: string;
}

/** Étudiant déjà connu (repris avec son historique) : sans frais d'inscription, avec son ancien matricule s'il en a un. */
export class AjouterExistantDto extends InscrireEtudiantDto {
  @ApiPropertyOptional({ example: 'ES240112', description: "Ancien matricule à conserver. S'il est absent, un nouveau est généré." })
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

  @ApiPropertyOptional({ description: 'Filière (REPRISE seulement). Par défaut : la filière de la dernière inscription.' })
  @IsOptional()
  @Transform(majuscules)
  @Matches(/^[A-Z0-9-]{2,20}$/)
  filiereCode?: string;

  @ApiPropertyOptional({ description: "Année scolaire visée (par défaut : l'année active)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  anneeId?: number;

  @ApiPropertyOptional({ enum: PIECES_DOSSIER, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PIECES_DOSSIER, { each: true })
  piecesFournies?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(100)
  faitA?: string;
}

/** Mise à jour des pièces remises (le candidat complète son dossier plus tard). */
export class MettreAJourPiecesDto {
  @ApiProperty({ enum: PIECES_DOSSIER, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsIn(PIECES_DOSSIER, { each: true })
  piecesFournies!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(100)
  faitA?: string;

  @ApiPropertyOptional({ description: "Année scolaire concernée (par défaut : l'année active)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  anneeId?: number;
}
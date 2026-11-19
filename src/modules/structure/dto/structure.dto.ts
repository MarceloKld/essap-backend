import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const majuscules = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

const CODE_STRUCTURE = /^[A-Z0-9-]{2,20}$/; // domaines et filières
const CODE_CLASSE = /^[A-Z][A-Z0-9]{0,4}$/; // L1, L2, M1, M2...

export class CreerDomaineDto {
  @ApiProperty({ example: 'SS' })
  @Transform(majuscules)
  @Matches(CODE_STRUCTURE, { message: 'Code invalide (2 à 20 caractères : A-Z, 0-9, tiret).' })
  code!: string;

  @ApiProperty({ example: 'Sciences de la santé' })
  @Transform(nettoyer)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  libelle!: string;
}

export class CreerFiliereDto {
  @ApiProperty({ example: 'SS', description: 'Code du domaine' })
  @Transform(majuscules)
  @Matches(CODE_STRUCTURE)
  domaineCode!: string;

  @ApiProperty({ example: 'AP' })
  @Transform(majuscules)
  @Matches(CODE_STRUCTURE, { message: 'Code invalide (2 à 20 caractères : A-Z, 0-9, tiret).' })
  code!: string;

  @ApiProperty({ example: 'Assistance en pharmacie' })
  @Transform(nettoyer)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  libelle!: string;
}

export class CreerClasseDto {
  @ApiProperty({ example: 'AP', description: 'Code de la filière' })
  @Transform(majuscules)
  @Matches(CODE_STRUCTURE)
  filiereCode!: string;

  @ApiProperty({ example: 'M1' })
  @Transform(majuscules)
  @Matches(CODE_CLASSE, { message: 'Code de classe invalide (ex. L1, M2).' })
  code!: string;

  @ApiProperty({ example: 'Master 1' })
  @Transform(nettoyer)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  libelle!: string;

  @ApiPropertyOptional({ description: 'Position dans la filière (1, 2, 3...). Par défaut : à la suite des classes existantes.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  ordre?: number;
}

/** Démarrage rapide d'un institut : un domaine, une filière et ses classes LMD en une seule requête. */
export class InitialiserStructureDto {
  @ApiProperty({ example: 'SS' })
  @Transform(majuscules)
  @Matches(CODE_STRUCTURE)
  domaineCode!: string;

  @ApiProperty({ example: 'Sciences de la santé' })
  @Transform(nettoyer)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  domaineLibelle!: string;

  @ApiProperty({ example: 'AP' })
  @Transform(majuscules)
  @Matches(CODE_STRUCTURE)
  filiereCode!: string;

  @ApiProperty({ example: 'Assistance en pharmacie' })
  @Transform(nettoyer)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  filiereLibelle!: string;

  @ApiPropertyOptional({ description: 'Ajouter aussi M1 et M2 (par défaut : L1, L2, L3 seulement)' })
  @IsOptional()
  @IsBoolean()
  avecMaster?: boolean;
}
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const ETATS_CIVILS = ['CELIBATAIRE', 'MARIE', 'AUTRE'] as const;

/** Identité d'un étudiant : les sections 1 et 2 de la fiche d'inscription papier. */
export class IdentiteEtudiantDto {
  // ---- 1. Identification du candidat
  @ApiProperty({ example: 'Mukendi' })
  @Transform(nettoyer)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nom!: string;

  @ApiPropertyOptional({ example: 'Kabeya' })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(80)
  postnom?: string;

  @ApiPropertyOptional({ example: 'Grace' })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(80)
  prenom?: string;

  @ApiProperty({ enum: ['M', 'F'] })
  @IsIn(['M', 'F'])
  sexe!: 'M' | 'F';

  @ApiProperty({ example: '2004-03-15', description: 'AAAA-MM-JJ (sert aussi à la connexion étudiant)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de naissance doit être au format AAAA-MM-JJ.' })
  dateNaissance!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(100)
  lieuNaissance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(60)
  nationalite?: string;

  @ApiPropertyOptional({ enum: ETATS_CIVILS })
  @IsOptional()
  @IsIn(ETATS_CIVILS)
  etatCivil?: 'CELIBATAIRE' | 'MARIE' | 'AUTRE';

  @ApiPropertyOptional({ example: '0812345678' })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(30)
  telephone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ description: 'Adresse / Commune' })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(255)
  adresse?: string;

  @ApiPropertyOptional({ description: "Contact d'urgence : nom" })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(150)
  contactUrgenceNom?: string;

  @ApiPropertyOptional({ description: "Contact d'urgence : téléphone" })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(30)
  contactUrgenceTelephone?: string;

  // ---- 2. Parcours scolaire et académique
  @ApiPropertyOptional({ example: "Diplôme d'État" })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(150)
  dernierDiplome?: string;

  @ApiPropertyOptional({ example: 2023 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  anneeObtention?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(150)
  etablissementOrigine?: string;

  @ApiPropertyOptional({ example: 'Kinshasa / RDC' })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(100)
  villePaysOrigine?: string;
}
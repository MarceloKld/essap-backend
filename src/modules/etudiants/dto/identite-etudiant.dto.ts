import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Identité d'un étudiant. Aucune photo : l'avatar dépend du sexe (§4 du cahier). */
export class IdentiteEtudiantDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(255)
  adresse?: string;

  @ApiPropertyOptional({ description: 'Tuteur ou parent' })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(150)
  nomTuteur?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(30)
  telephoneTuteur?: string;
}
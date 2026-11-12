import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsIn, IsOptional, IsString,
  Matches, MaxLength, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const majuscules = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const minuscules = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/** Rôles qu'on peut créer ICI. Le Super Admin n'apparaît volontairement pas dans cette liste. */
export const ROLES_AUTORITES = ['DG', 'SGAC', 'ADMIN_BUDGET'] as const;
export type RoleAutorite = (typeof ROLES_AUTORITES)[number];

export class AutoriteDto {
  @ApiProperty({ enum: ROLES_AUTORITES })
  @IsIn(ROLES_AUTORITES)
  role!: RoleAutorite;

  @ApiPropertyOptional({
    description: "DG déjà existant (qui gère plusieurs instituts) : son nom d'utilisateur. Les autres champs sont alors ignorés.",
  })
  @IsOptional()
  @Transform(minuscules)
  @IsString()
  nomUtilisateurExistant?: string;

  @ApiPropertyOptional({ example: 'Kabongo' })
  @ValidateIf((o: AutoriteDto) => !o.nomUtilisateurExistant)
  @Transform(nettoyer)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(80)
  postnom?: string;

  @ApiPropertyOptional({ example: 'Esther' })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(80)
  prenom?: string;

  @ApiPropertyOptional({ description: "Facultatif : généré automatiquement (ex. esther.kabongo) s'il est absent" })
  @IsOptional()
  @Transform(minuscules)
  @Matches(/^[a-z][a-z0-9._-]{2,49}$/, { message: "Nom d'utilisateur invalide (minuscules, chiffres, . _ -)." })
  nomUtilisateur?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(minuscules)
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: '0812345678' })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(30)
  telephone?: string;
}

export class CreerInstitutDto {
  @ApiProperty({ example: 'ESSAP-KIN', description: 'Code unique (lettres majuscules, chiffres, tirets)' })
  @Transform(majuscules)
  @Matches(/^[A-Z0-9-]{3,20}$/, { message: 'Code invalide (3 à 20 caractères : A-Z, 0-9, tiret).' })
  code!: string;

  @ApiProperty({ example: 'ESSAP – Kinshasa' })
  @Transform(nettoyer)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nom!: string;

  @ApiPropertyOptional({ example: 'ESSAP' })
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(20)
  sigle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(255)
  adresse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(30)
  telephone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(minuscules)
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiProperty({ example: 'ESSAP', description: 'Préfixe des matricules (lettres majuscules). Unique pour chaque institut.' })
  @Transform(majuscules)
  @Matches(/^[A-Z]{2,10}$/, { message: 'Préfixe invalide (2 à 10 lettres majuscules).' })
  prefixeMatricule!: string;

  @ApiProperty({ type: [AutoriteDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins une autorité est requise.' })
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AutoriteDto)
  autorites!: AutoriteDto[];
}
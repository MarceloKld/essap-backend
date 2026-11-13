import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const minuscules = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/** Le Super Admin n'apparaît volontairement pas : il ne se crée jamais par l'API. */
export const ROLES_CREABLES = ['DG', 'SGAC', 'ADMIN_BUDGET'] as const;
export type RoleCreable = (typeof ROLES_CREABLES)[number];

export class CreerUtilisateurDto {
  @ApiProperty({ enum: ROLES_CREABLES, description: 'Seul le Super Admin peut créer un DG.' })
  @IsIn(ROLES_CREABLES)
  role!: RoleCreable;

  @ApiProperty({ example: 'Kabongo' })
  @Transform(nettoyer)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nom!: string;

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
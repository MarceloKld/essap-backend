import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Le rôle et le nom d'utilisateur ne sont PAS modifiables ici. */
export class ModifierUtilisateurDto {
  @ApiPropertyOptional()
  @IsOptional()
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

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nettoyer)
  @IsString()
  @MaxLength(80)
  prenom?: string;

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
  @MaxLength(30)
  telephone?: string;
}
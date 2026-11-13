import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export const STATUTS_ETUDIANT = ['CANDIDAT', 'INSCRIT', 'ANCIEN', 'SUSPENDU', 'DIPLOME', 'PARTI'] as const;
export type StatutEtudiant = (typeof STATUTS_ETUDIANT)[number];

/** Pagination et recherche (héritées) + filtres. */
export class ListerEtudiantsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Étudiants inscrits dans cette année scolaire' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  anneeId?: number;

  @ApiPropertyOptional({ example: 'L1' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z][A-Z0-9]{0,4}$/)
  classeCode?: string;

  @ApiPropertyOptional({ enum: STATUTS_ETUDIANT })
  @IsOptional()
  @IsIn(STATUTS_ETUDIANT)
  statut?: StatutEtudiant;

  @ApiPropertyOptional({ enum: ['M', 'F'] })
  @IsOptional()
  @IsIn(['M', 'F'])
  sexe?: 'M' | 'F';
}
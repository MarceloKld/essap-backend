import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Paramètres de liste, à réutiliser partout : ?page=2&limite=20&q=mot
 * Les listes sont TOUJOURS paginées : jamais de « tout renvoyer » (checklist n°13).
 */
export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 20;

  @ApiPropertyOptional({ description: 'Recherche (nom, code, sigle)' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;
}

export function reponsePaginee<T>(donnees: T[], total: number, page: number, limite: number) {
  return { donnees, pagination: { page, limite, total, pages: Math.max(1, Math.ceil(total / limite)) } };
}
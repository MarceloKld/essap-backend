import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Min } from 'class-validator';

export class FicheRemplieDto {
  @ApiPropertyOptional({ description: "Année scolaire de la fiche (par défaut : la plus récente de l'étudiant)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  anneeId?: number;
}

export class FicheViergeDto {
  @ApiPropertyOptional({ example: 'AP', description: "Filière imprimée sur la fiche (par défaut : la filière unique de l'institut)" })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9-]{2,20}$/)
  filiereCode?: string;

  @ApiPropertyOptional({ description: "Année scolaire imprimée (par défaut : l'année active)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  anneeId?: number;
}
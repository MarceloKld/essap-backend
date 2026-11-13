import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ReinscrireEtudiantDto {
  @ApiProperty({ description: 'Classe pour la nouvelle année (voir GET /classes)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classeId!: number;

  @ApiPropertyOptional({ description: "Année scolaire (par défaut : l'année active)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  anneeId?: number;
}
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class CreerAnneeDto {
  @ApiProperty({ example: '2026-2027', description: 'Deux années consécutives' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^\d{4}-\d{4}$/, { message: 'Le libellé doit ressembler à 2026-2027.' })
  libelle!: string;

  @ApiProperty({ example: '2026-10-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date de début : format AAAA-MM-JJ.' })
  dateDebut!: string;

  @ApiProperty({ example: '2027-07-31' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date de fin : format AAAA-MM-JJ.' })
  dateFin!: string;

  @ApiPropertyOptional({ description: 'Rendre cette année active tout de suite (désactive la précédente)' })
  @IsOptional()
  @IsBoolean()
  activer?: boolean;
}
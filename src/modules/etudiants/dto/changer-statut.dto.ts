import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const STATUTS_MODIFIABLES = ['INSCRIT', 'ANCIEN', 'SUSPENDU', 'DIPLOME', 'PARTI'] as const;

export class ChangerStatutDto {
  @ApiProperty({ enum: STATUTS_MODIFIABLES })
  @IsIn(STATUTS_MODIFIABLES)
  statut!: (typeof STATUTS_MODIFIABLES)[number];

  @ApiProperty({ example: 'Dossier disciplinaire en cours' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5, { message: 'Le motif doit contenir au moins 5 caractères.' })
  @MaxLength(500)
  motif!: string;
}
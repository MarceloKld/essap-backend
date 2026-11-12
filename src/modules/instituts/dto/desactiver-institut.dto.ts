import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class DesactiverInstitutDto {
  @ApiProperty({ example: 'Contrat suspendu : facture impayée' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5, { message: 'Le motif doit contenir au moins 5 caractères.' })
  @MaxLength(500)
  motif!: string;
}
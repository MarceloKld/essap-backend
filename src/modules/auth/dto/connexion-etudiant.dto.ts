import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class ConnexionEtudiantDto {
  @ApiProperty({ example: 'DEMO2026L10001' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9-]{5,30}$/, { message: 'Matricule invalide.' })
  matricule!: string;

  @ApiProperty({ example: '2004-03-15', description: 'Format AAAA-MM-JJ' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date doit être au format AAAA-MM-JJ.' })
  dateNaissance!: string;
}
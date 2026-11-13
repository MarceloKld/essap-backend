import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
import { nettoyer } from '../../../common/dto/transformations.js';

export class CreerAnneeDto {
  @ApiProperty({ example: '2026-2027', description: 'Deux années consécutives' })
  @Transform(nettoyer)
  @Matches(/^\d{4}-\d{4}$/, { message: 'Le libellé doit être de la forme 2026-2027.' })
  libelle!: string;

  @ApiProperty({ example: '2026-10-01', description: 'AAAA-MM-JJ' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date doit être au format AAAA-MM-JJ.' })
  dateDebut!: string;

  @ApiProperty({ example: '2027-07-31', description: 'AAAA-MM-JJ' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date doit être au format AAAA-MM-JJ.' })
  dateFin!: string;
}
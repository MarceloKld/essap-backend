import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConnexionPersonnelDto {
  @ApiProperty({
    description: "Nom d'utilisateur, adresse email OU numéro de téléphone",
    example: 'sgac.demo',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  identifiant!: string;

  @ApiProperty({ example: 'Essap@Dev2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(128) // plafond : évite d'envoyer des textes géants à Argon2
  motDePasse!: string;
}
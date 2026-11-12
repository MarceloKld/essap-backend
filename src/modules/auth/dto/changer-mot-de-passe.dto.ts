import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangerMotDePasseDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  motDePasseActuel!: string;

  @ApiProperty({ example: 'MonNouveauMdp2026', description: '8 caractères minimum, au moins une lettre et un chiffre' })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @MaxLength(128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'Le mot de passe doit contenir au moins une lettre et un chiffre.' })
  nouveauMotDePasse!: string;
}
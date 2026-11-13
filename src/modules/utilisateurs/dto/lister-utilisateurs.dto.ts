import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { ROLES_CREABLES, type RoleCreable } from './creer-utilisateur.dto.js';

/** Pagination + recherche (hérités de PaginationDto) + filtre par rôle. */
export class ListerUtilisateursDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ROLES_CREABLES })
  @IsOptional()
  @IsIn(ROLES_CREABLES)
  role?: RoleCreable;
}
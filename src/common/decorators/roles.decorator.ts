import { SetMetadata } from '@nestjs/common';
import type { CodeRole } from '../types/jeton-acces.js';

export const CLE_ROLES = 'rolesAutorises';

/** @Roles('DG', 'SGAC') = seuls ces rôles (et le Super Admin) peuvent appeler la route. */
export const Roles = (...roles: CodeRole[]) => SetMetadata(CLE_ROLES, roles);
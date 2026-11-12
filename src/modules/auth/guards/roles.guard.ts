import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLE_PUBLIC } from '../../../common/decorators/public.decorator.js';
import { CLE_ROLES } from '../../../common/decorators/roles.decorator.js';
import type { CodeRole, RequeteAuthentifiee } from '../../../common/types/jeton-acces.js';

/**
 * Guard GLOBAL n°2 : vérifie le rôle quand la route déclare @Roles(...).
 * Le Super Admin peut tout faire. Sans @Roles, il suffit d'être connecté.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexte: ExecutionContext): boolean {
    const cibles = [contexte.getHandler(), contexte.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, cibles)) return true;

    const rolesAutorises = this.reflector.getAllAndOverride<CodeRole[]>(CLE_ROLES, cibles);
    if (!rolesAutorises || rolesAutorises.length === 0) return true;

    const { utilisateur } = contexte.switchToHttp().getRequest<RequeteAuthentifiee>();
    if (utilisateur.role === 'SUPER_ADMIN') return true;
    if (!rolesAutorises.includes(utilisateur.role)) {
      throw new ForbiddenException('Accès refusé pour votre rôle.');
    }
    return true;
  }
}
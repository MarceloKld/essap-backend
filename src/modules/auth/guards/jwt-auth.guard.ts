import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { CLE_PUBLIC } from '../../../common/decorators/public.decorator.js';
import type { PayloadAcces, RequeteAuthentifiee } from '../../../common/types/jeton-acces.js';

/**
 * Guard GLOBAL : il s'exécute avant CHAQUE route.
 *  1) route marquée @Public() -> on laisse passer ;
 *  2) sinon on exige un jeton "Authorization: Bearer xxx" valide ;
 *  3) on place le contenu du jeton dans requete.utilisateur.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(contexte: ExecutionContext): Promise<boolean> {
    const estPublic = this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, [
      contexte.getHandler(),
      contexte.getClass(),
    ]);
    if (estPublic) return true;

    const requete = contexte.switchToHttp().getRequest<RequeteAuthentifiee>();
    const jeton = this.extraireJeton(requete.headers.authorization);
    if (!jeton) throw new UnauthorizedException('Authentification requise.');

    try {
      // verifyAsync contrôle la SIGNATURE et la DATE D'EXPIRATION.
      requete.utilisateur = await this.jwt.verifyAsync<PayloadAcces>(jeton);
    } catch {
      throw new UnauthorizedException('Session expirée ou invalide.');
    }
    return true;
  }

  private extraireJeton(entete?: string): string | null {
    const [schema, jeton] = (entete ?? '').split(' ');
    return schema === 'Bearer' && jeton ? jeton : null;
  }
}
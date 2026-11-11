import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * @Controller('sante') -> toutes les routes ici commencent par /sante.
 * Avec le préfixe global « api » et la version « v1 », l'URL finale est :
 *   GET /api/v1/sante
 */
@ApiTags('Santé') // regroupe ces routes dans Swagger
@Controller('sante')
export class SanteController {
  @Get()
  @ApiOperation({ summary: "Vérifie que l'API répond (health-check)" })
  verifier() {
    // On ne renvoie volontairement AUCUNE info sensible (versions, chemins...).
    return {
      statut: 'ok',
      service: 'essap-api',
      horodatage: new Date().toISOString(),
    };
  }
}
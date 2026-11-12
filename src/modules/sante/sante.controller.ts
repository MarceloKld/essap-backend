import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@ApiTags('Santé')
@Public() // le health-check doit répondre sans connexion (pour UptimeRobot)
@Controller('sante')
export class SanteController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Vérifie que l'API et la base de données répondent" })
  async verifier() {
    let baseDeDonnees: 'ok' | 'indisponible' = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      baseDeDonnees = 'indisponible';
    }
    return {
      statut: baseDeDonnees === 'ok' ? 'ok' : 'degrade',
      baseDeDonnees,
      service: 'essap-api',
      horodatage: new Date().toISOString(),
    };
  }
}
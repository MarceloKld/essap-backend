import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service.js';

@ApiTags('Santé')
@Controller('sante')
export class SanteController {
  // Injection de dépendance : Nest fournit lui-même le PrismaService.
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Vérifie que l'API et la base de données répondent" })
  async verifier() {
    let baseDeDonnees: 'ok' | 'indisponible' = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`; // requête minimale pour tester la connexion
    } catch {
      baseDeDonnees = 'indisponible'; // on n'expose JAMAIS le détail de l'erreur
    }
    return {
      statut: baseDeDonnees === 'ok' ? 'ok' : 'degrade',
      baseDeDonnees,
      service: 'essap-api',
      horodatage: new Date().toISOString(),
    };
  }
}
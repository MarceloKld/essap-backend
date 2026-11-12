import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface EvenementAudit {
  action: string; // ex. CONNEXION_REUSSIE
  utilisateurId?: string | null;
  institutId?: number | null;
  entite?: string;
  entiteId?: string;
  details?: Record<string, string | number | boolean | null>;
  avant?: unknown; // valeurs avant une modification
  apres?: unknown; // valeurs après une modification
  adresseIp?: string | null;
  appareil?: string | null;
}

/** Convertit un objet (avec dates, etc.) en JSON simple, acceptable par la base. */
const enJson = (valeur: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(valeur)) as Prisma.InputJsonValue;

/**
 * Écrit dans la table "journal_audit" (qui, quand, quoi, depuis quelle IP).
 * Un échec du journal ne doit JAMAIS faire échouer l'action de l'utilisateur.
 */
@Injectable()
export class AuditService {
  private readonly journal = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enregistrer(evenement: EvenementAudit): Promise<void> {
    try {
      await this.prisma.journalAudit.create({
        data: {
          action: evenement.action,
          utilisateurId: evenement.utilisateurId ?? null,
          institutId: evenement.institutId ?? null,
          entite: evenement.entite ?? null,
          entiteId: evenement.entiteId ?? null,
          details: evenement.details ?? undefined,
          avant: evenement.avant === undefined ? undefined : enJson(evenement.avant),
          apres: evenement.apres === undefined ? undefined : enJson(evenement.apres),
          adresseIp: evenement.adresseIp ?? null,
          appareil: evenement.appareil ?? null,
        },
      });
    } catch (erreur) {
      this.journal.error(`Écriture du journal d'audit impossible (${evenement.action})`, String(erreur));
    }
  }
}
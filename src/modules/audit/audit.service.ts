import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface EvenementAudit {
  action: string; // ex. CONNEXION_REUSSIE
  utilisateurId?: string | null;
  institutId?: number | null;
  entite?: string;
  entiteId?: string;
  details?: Record<string, string | number | boolean | null>;
  adresseIp?: string | null;
  appareil?: string | null;
}

/**
 * Écrit dans la table "journal_audit" (qui, quand, quoi, depuis quelle IP).
 * Règle d'or : un échec du journal ne doit JAMAIS faire échouer l'action de l'utilisateur,
 * donc on attrape l'erreur et on la note simplement dans les logs.
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
          adresseIp: evenement.adresseIp ?? null,
          appareil: evenement.appareil ?? null,
        },
      });
    } catch (erreur) {
      this.journal.error(`Écriture du journal d'audit impossible (${evenement.action})`, String(erreur));
    }
  }
}
import type { Request } from 'express';
import type { ContexteRequete } from '../../modules/auth/auth.types.js';

/** IP et appareil de l'appelant, pour le journal d'audit. */
export function contexteRequete(req: Request): ContexteRequete {
  const appareil = (req.headers['user-agent'] ?? '').slice(0, 255);
  return { adresseIp: req.ip ?? null, appareil: appareil || null };
}
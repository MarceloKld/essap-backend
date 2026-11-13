import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { ContexteRequete } from '../auth/auth.types.js';
import { CloudinaryService } from '../medias/cloudinary.service.js';
import { ImageService } from '../medias/image.service.js';
import type { PayloadAcces } from '../../common/types/jeton-acces.js';
import { verifierAccesInstitut } from '../../common/utils/acces-institut.js';
import type { FichierEnvoye } from '../../common/types/fichier-envoye.js';

@Injectable()
export class LogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly images: ImageService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async definir(utilisateur: PayloadAcces, id: number, fichier: FichierEnvoye | undefined, ctx: ContexteRequete) {
    // 1) Droit d'agir sur CET institut, puis existence
    verifierAccesInstitut(utilisateur, id);
    const institut = await this.prisma.institut.findFirst({ where: { id, supprimeLe: null }, select: { id: true } });
    if (!institut) throw new NotFoundException('Institut introuvable.');

    // 2) Fichier présent, vraie image, réduite et convertie en WebP
    if (!fichier) throw new BadRequestException('Aucun fichier reçu : envoyez une image dans le champ « fichier ».');
    const logo = await this.images.preparerLogo(fichier.buffer);

    // 3) Envoi sur Cloudinary, puis enregistrement de l'adresse
    const { url, idPublic } = await this.cloudinary.televerserLogo(id, logo.tampon);
    await this.prisma.institut.update({ where: { id }, data: { logoUrl: url, logoIdPublic: idPublic } });

    await this.audit.enregistrer({
      action: 'INSTITUT_LOGO_MODIFIE',
      utilisateurId: utilisateur.sub,
      institutId: id,
      entite: 'instituts',
      entiteId: String(id),
      details: { octetsOriginal: fichier.size, octetsFinal: logo.octets },
      ...ctx,
    });

    return {
      logoUrl: url,
      original: { octets: fichier.size },
      final: { octets: logo.octets, largeur: logo.largeur, hauteur: logo.hauteur, format: 'webp' },
    };
  }

  async supprimer(utilisateur: PayloadAcces, id: number, ctx: ContexteRequete) {
    verifierAccesInstitut(utilisateur, id);
    const institut = await this.prisma.institut.findFirst({
      where: { id, supprimeLe: null },
      select: { id: true, logoIdPublic: true },
    });
    if (!institut) throw new NotFoundException('Institut introuvable.');

    if (institut.logoIdPublic) await this.cloudinary.supprimer(institut.logoIdPublic);
    await this.prisma.institut.update({ where: { id }, data: { logoUrl: null, logoIdPublic: null } });

    await this.audit.enregistrer({
      action: 'INSTITUT_LOGO_SUPPRIME',
      utilisateurId: utilisateur.sub,
      institutId: id,
      entite: 'instituts',
      entiteId: String(id),
      ...ctx,
    });
    return { logoUrl: null };
  }
}
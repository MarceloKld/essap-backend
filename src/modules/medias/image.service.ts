import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

const FORMATS_AUTORISES = ['jpeg', 'png', 'webp'];
const LIMITE_PIXELS = 25_000_000; // contre les « bombes d'images » : fichier léger mais image gigantesque
const COTE_MAX_LOGO = 512;
const COTE_MIN_LOGO = 64;

export interface LogoPrepare {
  tampon: Buffer;
  largeur: number;
  hauteur: number;
  octets: number;
}

/**
 * Prépare une image avant envoi : on vérifie qu'elle est VRAIE, on la réduit, on la convertit en WebP.
 * La librairie "sharp" décode réellement le fichier : l'extension et le type annoncés par
 * le navigateur ne comptent pas (ils sont faciles à falsifier).
 */
@Injectable()
export class ImageService {
  async preparerLogo(source: Buffer): Promise<LogoPrepare> {
    // 1) Est-ce vraiment une image lisible ? De quel format ?
    const meta = await this.lireMetadonnees(source);
    if (!meta) throw new BadRequestException("Fichier invalide : ce n'est pas une image lisible.");
    if (!meta.format || !FORMATS_AUTORISES.includes(meta.format)) {
      throw new BadRequestException('Format non autorisé : PNG, JPEG ou WebP uniquement.');
    }
    if ((meta.width ?? 0) < COTE_MIN_LOGO || (meta.height ?? 0) < COTE_MIN_LOGO) {
      throw new BadRequestException(`Image trop petite (${COTE_MIN_LOGO} × ${COTE_MIN_LOGO} pixels minimum).`);
    }

    // 2) Réduction + conversion en WebP
    try {
      const { data, info } = await sharp(source, { limitInputPixels: LIMITE_PIXELS })
        .rotate() // corrige l'orientation (photos de téléphone)
        .resize({ width: COTE_MAX_LOGO, height: COTE_MAX_LOGO, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 }) // la transparence des logos PNG est conservée
        .toBuffer({ resolveWithObject: true });
      return { tampon: data, largeur: info.width, hauteur: info.height, octets: info.size };
    } catch {
      throw new BadRequestException("Impossible de traiter l'image.");
    }
  }

  /** Lit les informations de l'image (format, dimensions). Renvoie null si le fichier n'est pas une image. */
  private async lireMetadonnees(source: Buffer) {
    try {
      return await sharp(source, { limitInputPixels: LIMITE_PIXELS }).metadata();
    } catch {
      return null;
    }
  }
}
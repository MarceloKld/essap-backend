import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Envoi et suppression des logos sur Cloudinary.
 * Les clés viennent du .env. Si elles manquent, l'application démarre quand même :
 * seul l'envoi de logo répond « 503 service indisponible ».
 */
@Injectable()
export class CloudinaryService {
  private readonly journal = new Logger(CloudinaryService.name);
  readonly configure: boolean;

  constructor(config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');
    this.configure = Boolean(cloudName && apiKey && apiSecret);
    if (this.configure) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    }
  }

  /** Envoie (ou remplace) le logo d'un institut. Un institut = un seul logo : institut-<id>. */
  televerserLogo(institutId: number, image: Buffer): Promise<{ url: string; idPublic: string }> {
    if (!this.configure) {
      throw new ServiceUnavailableException("Le service d'images n'est pas configuré (Cloudinary).");
    }
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: 'essap/logos',
            public_id: `institut-${institutId}`,
            overwrite: true, // le nouveau logo remplace l'ancien
            invalidate: true, // le cache Cloudinary est vidé
            resource_type: 'image',
          },
          (erreur, resultat) => {
            if (erreur || !resultat) {
              this.journal.error(`Échec d'envoi Cloudinary : ${String(erreur?.message ?? erreur)}`);
              reject(new ServiceUnavailableException("L'envoi de l'image a échoué. Réessayez plus tard."));
              return;
            }
            resolve({ url: resultat.secure_url, idPublic: resultat.public_id });
          },
        )
        .end(image);
    });
  }

  async supprimer(idPublic: string): Promise<void> {
    if (!this.configure) return;
    try {
      await cloudinary.uploader.destroy(idPublic, { invalidate: true });
    } catch (erreur) {
      // Une image orpheline coûte très peu ; on ne bloque pas l'action de l'utilisateur.
      this.journal.warn(`Suppression Cloudinary impossible (${idPublic}) : ${String(erreur)}`);
    }
  }
}
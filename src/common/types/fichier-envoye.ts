/** Fichier reçu par un envoi multipart (ce que multer place dans la requête). */
export interface FichierEnvoye {
  buffer: Buffer; // le contenu du fichier, gardé en mémoire (jamais écrit sur le disque)
  size: number; // taille en octets
  mimetype: string; // type ANNONCÉ par le navigateur (falsifiable : on ne s'y fie pas)
  originalname: string;
}
/** Pièces à fournir (section 4 de la fiche). On ne stocke AUCUN fichier : on note seulement ce qui a été remis. */
export const PIECES_DOSSIER = ['DIPLOME', 'IDENTITE', 'PHOTOS', 'AUTRES'] as const;
export type PieceDossier = (typeof PIECES_DOSSIER)[number];
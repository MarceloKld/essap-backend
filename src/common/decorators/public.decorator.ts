import { SetMetadata } from '@nestjs/common';

export const CLE_PUBLIC = 'estPublic';

/**
 * @Public() = cette route est accessible SANS être connecté.
 * Principe « deny-by-default » : toutes les routes exigent une connexion,
 * sauf celles qu'on marque explicitement @Public().
 */
export const Public = () => SetMetadata(CLE_PUBLIC, true);
/** Nom du cookie qui contient le refresh token (invisible pour le JavaScript du navigateur). */
export const NOM_COOKIE_RAFRAICHISSEMENT = 'essap_rt';

/** Le cookie n'est envoyé QUE vers les routes /auth : le reste de l'API ne le voit jamais. */
export const CHEMIN_COOKIE = '/api/v1/auth';
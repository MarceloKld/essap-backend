export type TypeIdentifiant = 'EMAIL' | 'TELEPHONE' | 'NOM_UTILISATEUR';

/** Règle des noms d'utilisateur : commence par une lettre, minuscules, chiffres, . _ - (3 à 50 caractères). */
export const REGEX_NOM_UTILISATEUR = /^[a-z][a-z0-9._-]{2,49}$/;

/**
 * Met un numéro de téléphone au format international (ex. +243817655587), pour que
 * « 081 765 55 87 », « 0817655587 » et « +243 81 765 55 87 » soient reconnus comme le MÊME numéro.
 * Renvoie null si le format n'est pas reconnu.
 */
export function normaliserTelephone(brut: string): string | null {
  const net = brut.replace(/[\s.\-()]/g, '');
  if (/^\+\d{8,15}$/.test(net)) return net;
  if (/^00\d{8,15}$/.test(net)) return '+' + net.slice(2);
  if (/^243\d{9}$/.test(net)) return '+' + net;
  if (/^0\d{9}$/.test(net)) return '+243' + net.slice(1);
  return null;
}

/**
 * Devine ce que la personne a tapé : un email, un téléphone ou un nom d'utilisateur.
 * C'est ce qui permet une seule case « identifiant » à la connexion.
 */
export function analyserIdentifiant(brut: string): { type: TypeIdentifiant; valeur: string } {
  const texte = brut.trim();
  if (texte.includes('@')) return { type: 'EMAIL', valeur: texte.toLowerCase() };
  if (/^[+()\d\s.\-]+$/.test(texte)) {
    const tel = normaliserTelephone(texte);
    if (tel) return { type: 'TELEPHONE', valeur: tel };
  }
  return { type: 'NOM_UTILISATEUR', valeur: texte.toLowerCase() };
}
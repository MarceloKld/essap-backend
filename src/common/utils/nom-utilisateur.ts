/** Retire accents et caractères spéciaux : « Éloïse » devient « eloise ». */
function simplifier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Propose un nom d'utilisateur lisible à partir du prénom et du nom : « Esther Kabongo » -> « esther.kabongo ».
 * Pensé pour des personnes peu à l'aise avec le numérique.
 */
export function baseNomUtilisateur(prenom: string | undefined, nom: string): string {
  let base = [prenom, nom]
    .map((p) => simplifier(p ?? ''))
    .filter((p) => p.length > 0)
    .join('.');
  if (!/^[a-z]/.test(base)) base = `u${base}`;
  if (base.length < 3) base = `${base}user`;
  return base.slice(0, 40);
}
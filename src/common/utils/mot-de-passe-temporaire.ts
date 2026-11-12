import { randomInt } from 'node:crypto';

// Sans caractères qui se ressemblent (0/O, 1/l/I) : le mot de passe sera lu puis recopié par une personne.
const MAJUSCULES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULES = 'abcdefghijkmnpqrstuvwxyz';
const CHIFFRES = '23456789';

const tirer = (alphabet: string): string => alphabet[randomInt(alphabet.length)];

/** Mot de passe temporaire de 10 caractères (lettres + chiffres), tiré avec un aléa cryptographique. */
export function genererMotDePasseTemporaire(): string {
  const caracteres = [
    tirer(MAJUSCULES), tirer(MAJUSCULES),
    ...Array.from({ length: 5 }, () => tirer(MINUSCULES)),
    ...Array.from({ length: 3 }, () => tirer(CHIFFRES)),
  ];
  // Mélange de Fisher-Yates : les lettres et chiffres ne sont pas toujours aux mêmes places.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}
import PDFDocument from 'pdfkit';

type Doc = InstanceType<typeof PDFDocument>;

export interface CandidatFiche {
  nom: string | null; postnom: string | null; prenom: string | null;
  sexe: 'M' | 'F' | null;
  dateNaissance: string | null; lieuNaissance: string | null; nationalite: string | null;
  etatCivil: 'CELIBATAIRE' | 'MARIE' | 'AUTRE' | null;
  telephone: string | null; email: string | null; adresse: string | null; contactUrgence: string | null;
  dernierDiplome: string | null; anneeObtention: string | null;
  etablissementOrigine: string | null; villePaysOrigine: string | null;
}

export interface DonneesFiche {
  institut: { nom: string; sigle: string | null; adresse: string | null; telephone: string | null; telephone2: string | null };
  logo: Buffer | null; // PNG ou JPEG (pdfkit ne lit pas le WebP)
  anneeLibelle: string;
  filiereLibelle: string | null;
  classeCode: string | null;
  classesProposees: string[]; // fiche vierge : classes à cocher
  matricule: string | null;
  typeDemande: 'INSCRIPTION' | 'REINSCRIPTION' | 'IMPORTE' | null;
  piecesFournies: string[];
  faitA: string | null;
  dateFiche: string | null;
  candidat: CandidatFiche | null; // null = fiche vierge
}

/** +243898997266 -> « +243 898 997 266 » (pour l'affichage). */
export function afficherTelephone(tel: string | null): string | null {
  if (!tel) return null;
  const m = /^\+243(\d{3})(\d{3})(\d{3})$/.exec(tel);
  return m ? `+243 ${m[1]} ${m[2]} ${m[3]}` : tel;
}

// ---- Couleurs et dimensions de la fiche officielle (A4 : 595 x 842 points)
const VERT = '#0B7A3B';
const VERT_CLAIR = '#E6F2EA';
const BLEU = '#1F4EB4';
const JAUNE = '#FFF1B8';
const NOIR = '#000000';
const LARGEUR_PAGE = 595.28;
const MARGE = 40;
const LARGEUR = LARGEUR_PAGE - 2 * MARGE;
const MI = LARGEUR / 2;
const H_BARRE = 17;
const H_LIGNE = 23;

/** Fabrique le PDF en mémoire et le renvoie sous forme de Buffer (rien n'est écrit sur le disque). */
export function genererPdf(donnees: DonneesFiche): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 28, bottom: 28, left: MARGE, right: MARGE },
      info: { Title: "Fiche d'inscription", Author: donnees.institut.sigle ?? donnees.institut.nom },
    });
    const morceaux: Buffer[] = [];
    doc.on('data', (morceau: Buffer) => morceaux.push(morceau));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);
    try {
      dessiner(doc, donnees);
      doc.end();
    } catch (erreur) {
      reject(erreur);
    }
  });
}

// ------------------------------------------------------------------ éléments de dessin
function barre(doc: Doc, y: number, titre: string): number {
  doc.rect(MARGE, y, LARGEUR, H_BARRE).fill(VERT);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
    .text(titre, MARGE, y + 4.5, { width: LARGEUR, align: 'center', lineBreak: false });
  return y + H_BARRE;
}

function cadre(doc: Doc, x: number, y: number, w: number, h: number, fond?: string): void {
  doc.lineWidth(0.6);
  if (fond) doc.rect(x, y, w, h).fillAndStroke(fond, NOIR);
  else doc.rect(x, y, w, h).strokeColor(NOIR).stroke();
}

function caseACocher(doc: Doc, x: number, y: number, cochee: boolean): void {
  doc.lineWidth(0.7).strokeColor(NOIR).rect(x, y, 8, 8).stroke();
  if (cochee) {
    doc.lineWidth(1.1)
      .moveTo(x + 1.5, y + 1.5).lineTo(x + 6.5, y + 6.5)
      .moveTo(x + 6.5, y + 1.5).lineTo(x + 1.5, y + 6.5)
      .stroke();
  }
}

/** Cellule « Libellé : valeur » ; sans valeur, des pointillés comme sur la fiche papier. */
function ligneTexte(doc: Doc, x: number, y: number, w: number, libelle: string, valeur: string | null): void {
  cadre(doc, x, y, w, H_LIGNE);
  const yTexte = y + (H_LIGNE - 8.5) / 2;
  doc.fillColor(NOIR).font('Helvetica').fontSize(8.5);
  const prefixe = `${libelle} : `;
  doc.text(prefixe, x + 5, yTexte, { lineBreak: false });
  const largeurPrefixe = doc.widthOfString(prefixe);
  const reste = w - 10 - largeurPrefixe;
  if (valeur) {
    doc.font('Helvetica-Bold').text(valeur, x + 5 + largeurPrefixe, yTexte, { width: reste, height: 10, ellipsis: true });
  } else {
    const nombrePoints = Math.max(3, Math.floor(reste / doc.widthOfString('.')));
    doc.text('.'.repeat(nombrePoints), x + 5 + largeurPrefixe, yTexte, { lineBreak: false });
  }
}

/** Cellule avec cases à cocher : « Sexe : [ ] M  [ ] F ». */
function ligneOptions(
  doc: Doc, x: number, y: number, w: number, libelle: string | null, options: Array<{ texte: string; cochee: boolean }>,
): void {
  cadre(doc, x, y, w, H_LIGNE);
  const yTexte = y + (H_LIGNE - 8.5) / 2;
  doc.fillColor(NOIR).font('Helvetica').fontSize(8.5);
  let curseur = x + 6;
  if (libelle) {
    const prefixe = `${libelle} : `;
    doc.text(prefixe, x + 5, yTexte, { lineBreak: false });
    curseur = x + 5 + doc.widthOfString(prefixe) + 2;
  }
  for (const option of options) {
    caseACocher(doc, curseur, y + (H_LIGNE - 8) / 2, option.cochee);
    doc.fillColor(NOIR).font('Helvetica').fontSize(8.5).text(option.texte, curseur + 11, yTexte, { lineBreak: false });
    curseur += 11 + doc.widthOfString(option.texte) + 9;
  }
}

function celluleTitre(doc: Doc, x: number, y: number, w: number, h: number, texte: string, centre: boolean): void {
  cadre(doc, x, y, w, h, VERT_CLAIR);
  doc.fillColor(NOIR).font('Helvetica-Bold').fontSize(8.5)
    .text(texte, x + 5, y + (h - 8.5) / 2, { width: w - 10, align: centre ? 'center' : 'left', lineBreak: false });
}

// ------------------------------------------------------------------ la fiche
function dessiner(doc: Doc, d: DonneesFiche): void {
  const c = d.candidat;
  const G = MARGE;
  const D = MARGE + MI;
  let y = 28;

  // ---- En-tête : logo, nom de l'établissement, sigle, titre, bandeau de la filière
  if (d.logo) {
    try {
      doc.image(d.logo, (LARGEUR_PAGE - 60) / 2, y, { fit: [60, 60], align: 'center', valign: 'center' });
      y += 64;
    } catch {
      /* logo illisible : on continue sans */
    }
  }
  doc.fillColor(VERT).font('Helvetica-Bold').fontSize(10.5)
    .text(d.institut.nom.toUpperCase(), MARGE, y, { width: LARGEUR, align: 'center' });
  y = doc.y + 3;
  if (d.institut.sigle) {
    doc.fillColor(BLEU).fontSize(19).text(d.institut.sigle, MARGE, y, { width: LARGEUR, align: 'center' });
    y = doc.y + 2;
  }
  doc.fillColor(VERT).fontSize(9.5)
    .text(`FICHE D'INSCRIPTION - ANNÉE ACADÉMIQUE ${d.anneeLibelle}`, MARGE, y, { width: LARGEUR, align: 'center' });
  y = doc.y + 6;

  doc.rect(MARGE, y, LARGEUR, 20).fill(JAUNE);
  doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(9).text(
    `FILIÈRE CONCERNÉE PAR LES INSCRIPTIONS : ${d.filiereLibelle ? d.filiereLibelle.toUpperCase() : '..............................'}`,
    MARGE, y + 6, { width: LARGEUR, align: 'center', lineBreak: false },
  );
  y += 26;

  // ---- 1. Identification du candidat
  y = barre(doc, y, '1. IDENTIFICATION DU CANDIDAT');
  ligneTexte(doc, G, y, MI, 'Nom', c?.nom ?? null);
  ligneTexte(doc, D, y, MI, 'Post-nom', c?.postnom ?? null);
  y += H_LIGNE;
  ligneTexte(doc, G, y, MI, 'Prénom(s)', c?.prenom ?? null);
  ligneOptions(doc, D, y, MI, 'Sexe', [{ texte: 'M', cochee: c?.sexe === 'M' }, { texte: 'F', cochee: c?.sexe === 'F' }]);
  y += H_LIGNE;
  ligneTexte(doc, G, y, MI, 'Date de naissance', c?.dateNaissance ?? null);
  ligneTexte(doc, D, y, MI, 'Lieu de naissance', c?.lieuNaissance ?? null);
  y += H_LIGNE;
  ligneTexte(doc, G, y, MI, 'Nationalité', c?.nationalite ?? null);
  ligneOptions(doc, D, y, MI, 'État civil', [
    { texte: 'Célibataire', cochee: c?.etatCivil === 'CELIBATAIRE' },
    { texte: 'Marié(e)', cochee: c?.etatCivil === 'MARIE' },
    { texte: 'Autre', cochee: c?.etatCivil === 'AUTRE' },
  ]);
  y += H_LIGNE;
  ligneTexte(doc, G, y, MI, 'N° téléphone', c?.telephone ?? null);
  ligneTexte(doc, D, y, MI, 'E-mail', c?.email ?? null);
  y += H_LIGNE;
  ligneTexte(doc, G, y, MI, 'Adresse / Commune', c?.adresse ?? null);
  ligneTexte(doc, D, y, MI, "Contact d'urgence", c?.contactUrgence ?? null);
  y += H_LIGNE;

  // ---- 2. Parcours scolaire et académique
  y = barre(doc, y, '2. PARCOURS SCOLAIRE ET ACADÉMIQUE');
  ligneTexte(doc, G, y, MI, 'Dernier diplôme obtenu', c?.dernierDiplome ?? null);
  ligneTexte(doc, D, y, MI, "Année d'obtention", c?.anneeObtention ?? null);
  y += H_LIGNE;
  ligneTexte(doc, G, y, MI, 'Établissement', c?.etablissementOrigine ?? null);
  ligneTexte(doc, D, y, MI, 'Ville / Pays', c?.villePaysOrigine ?? null);
  y += H_LIGNE;

  // ---- 3. Inscription
  y = barre(doc, y, '3. INSCRIPTION');
  celluleTitre(doc, G, y, MI, H_LIGNE, 'Filière', false);
  cadre(doc, D, y, MI, H_LIGNE);
  caseACocher(doc, D + 6, y + (H_LIGNE - 8) / 2, d.filiereLibelle !== null);
  doc.fillColor(NOIR).font('Helvetica').fontSize(8.5).text(
    d.filiereLibelle ? d.filiereLibelle.toUpperCase() : '.'.repeat(40),
    D + 20, y + (H_LIGNE - 8.5) / 2, { width: MI - 26, height: 10, ellipsis: true },
  );
  y += H_LIGNE;
  celluleTitre(doc, G, y, MI, H_LIGNE, 'Type de demande', false);
  ligneOptions(doc, D, y, MI, null, [
    { texte: 'Première inscription', cochee: d.typeDemande === 'INSCRIPTION' },
    { texte: 'Réinscription', cochee: d.typeDemande === 'REINSCRIPTION' },
  ]);
  y += H_LIGNE;
  // Ajout du logiciel (absent de la fiche papier) : classe visée et matricule
  const optionsClasses = d.classeCode
    ? [{ texte: d.classeCode, cochee: true }]
    : d.classesProposees.map((code) => ({ texte: code, cochee: false }));
  ligneOptions(doc, G, y, MI, 'Classe', optionsClasses);
  ligneTexte(doc, D, y, MI, 'Matricule', d.matricule);
  y += H_LIGNE;

  // ---- 4. Pièces à fournir
  y = barre(doc, y, '4. PIÈCES À FOURNIR') + 5;
  const sigle = d.institut.sigle ? `l'${d.institut.sigle}` : "l'établissement";
  const pieces = [
    { code: 'DIPLOME', texte: "Copie du diplôme ou de l'attestation de réussite" },
    { code: 'IDENTITE', texte: "Copie d'une pièce d'identité" },
    { code: 'PHOTOS', texte: "Photos d'identité récentes" },
    { code: 'AUTRES', texte: `Autres pièces demandées par l'administration de ${sigle}` },
  ];
  for (const piece of pieces) {
    caseACocher(doc, MARGE + 6, y, d.piecesFournies.includes(piece.code));
    doc.fillColor(NOIR).font('Helvetica').fontSize(9).text(piece.texte, MARGE + 20, y - 0.5, { lineBreak: false });
    y += 14;
  }
  y += 3;

  // ---- 5. Engagement du candidat
  y = barre(doc, y, '5. ENGAGEMENT DU CANDIDAT') + 4;
  doc.fillColor(NOIR).font('Helvetica').fontSize(8.5).text(
    `Je soussigné(e), certifie exactes les informations fournies dans la présente fiche et m'engage à respecter le règlement intérieur ainsi que les dispositions administratives et pédagogiques de ${sigle}.`,
    MARGE, y, { width: LARGEUR },
  );
  y = doc.y + 4;
  ligneTexte(doc, G, y, MI, 'Fait à', d.faitA);
  ligneTexte(doc, D, y, MI, 'Date', d.dateFiche);
  y += H_LIGNE;
  celluleTitre(doc, G, y, MI, 17, 'Signature du candidat', true);
  celluleTitre(doc, D, y, MI, 17, "Visa / Signature de l'administration", true);
  y += 17;
  cadre(doc, G, y, MI, 38);
  cadre(doc, D, y, MI, 38);
  y += 38;

  // ---- Pied de page : lieu d'inscription et contacts
  y += 10;
  doc.lineWidth(1.2).strokeColor('#4A78C8').moveTo(MARGE + 8, y).lineTo(LARGEUR_PAGE - MARGE - 8, y).stroke();
  y += 5;
  if (d.institut.adresse) {
    doc.fillColor('#222222').font('Helvetica').fontSize(7.5)
      .text(`Lieu d'inscription : ${d.institut.adresse}.`, MARGE, y, { width: LARGEUR, align: 'center' });
    y = doc.y + 1;
  }
  const contacts = [afficherTelephone(d.institut.telephone), afficherTelephone(d.institut.telephone2)].filter(Boolean).join(' / ');
  if (contacts) {
    doc.fillColor(VERT).font('Helvetica-Bold').fontSize(8)
      .text(`Contacts : ${contacts}`, MARGE, y, { width: LARGEUR, align: 'center' });
  }
}
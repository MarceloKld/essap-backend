-- B5 : règles garanties par la base de données elle-même.

-- 1) UNE SEULE année scolaire active par institut.
--    C'est un « index unique partiel » : il ne concerne que les lignes où est_active vaut vrai.
CREATE UNIQUE INDEX "uq_une_annee_active_par_institut"
  ON "annees_scolaires" ("institut_id")
  WHERE "est_active" = true;

-- 2) Les matricules ont un numéro de séquence à 4 chiffres (ex. ESSAP2026L10001).
UPDATE "parametres"
  SET "valeur" = jsonb_set("valeur", '{longueurSequence}', '4')
  WHERE "cle" = 'matricule.format';
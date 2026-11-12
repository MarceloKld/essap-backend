-- CreateEnum
CREATE TYPE "sexe" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "statut_etudiant" AS ENUM ('CANDIDAT', 'INSCRIT', 'ANCIEN', 'SUSPENDU', 'DIPLOME', 'PARTI');

-- CreateEnum
CREATE TYPE "type_inscription" AS ENUM ('INSCRIPTION', 'REINSCRIPTION', 'IMPORTE');

-- CreateEnum
CREATE TYPE "etat_annuel" AS ENUM ('INSCRIT', 'ABSENT', 'ABANDON', 'DIPLOME');

-- CreateEnum
CREATE TYPE "nature_frais" AS ENUM ('ACADEMIQUE', 'ANNEXE');

-- CreateEnum
CREATE TYPE "devise" AS ENUM ('FC', 'USD');

-- CreateEnum
CREATE TYPE "mode_paiement" AS ENUM ('ESPECES', 'MOBILE_MONEY', 'BANQUE');

-- CreateEnum
CREATE TYPE "statut_paiement" AS ENUM ('EN_ATTENTE', 'VALIDE', 'ANNULE');

-- CreateEnum
CREATE TYPE "statut_recu" AS ENUM ('VALIDE', 'REMPLACE');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "libelle" VARCHAR(80) NOT NULL,
    "description" VARCHAR(255),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "institut_id" INTEGER,
    "role_id" INTEGER NOT NULL,
    "nom_utilisateur" VARCHAR(50) NOT NULL,
    "email" VARCHAR(150),
    "telephone" VARCHAR(30),
    "mot_de_passe_hache" TEXT NOT NULL,
    "nom" VARCHAR(80) NOT NULL,
    "postnom" VARCHAR(80),
    "prenom" VARCHAR(80),
    "doit_changer_mot_de_passe" BOOLEAN NOT NULL DEFAULT true,
    "tentatives_echouees" INTEGER NOT NULL DEFAULT 0,
    "verrouille_jusqua" TIMESTAMPTZ(3),
    "derniere_connexion_le" TIMESTAMPTZ(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_par" UUID,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,
    "supprime_le" TIMESTAMPTZ(3),

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comptes_etudiants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "etudiant_id" UUID NOT NULL,
    "tentatives_echouees" INTEGER NOT NULL DEFAULT 0,
    "verrouille_jusqua" TIMESTAMPTZ(3),
    "derniere_connexion_le" TIMESTAMPTZ(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comptes_etudiants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jetons_rafraichissement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "famille_id" UUID NOT NULL,
    "empreinte" VARCHAR(64) NOT NULL,
    "utilisateur_id" UUID,
    "compte_etudiant_id" UUID,
    "appareil" VARCHAR(255),
    "adresse_ip" VARCHAR(45),
    "expire_le" TIMESTAMPTZ(3) NOT NULL,
    "utilise_le" TIMESTAMPTZ(3),
    "revoque_le" TIMESTAMPTZ(3),
    "motif_revocation" VARCHAR(60),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jetons_rafraichissement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" BIGSERIAL NOT NULL,
    "utilisateur_id" UUID,
    "institut_id" INTEGER,
    "action" VARCHAR(60) NOT NULL,
    "entite" VARCHAR(60),
    "entite_id" VARCHAR(60),
    "details" JSONB,
    "avant" JSONB,
    "apres" JSONB,
    "adresse_ip" VARCHAR(45),
    "appareil" VARCHAR(255),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etudiants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "institut_id" INTEGER NOT NULL,
    "matricule" VARCHAR(30),
    "nom" VARCHAR(80) NOT NULL,
    "postnom" VARCHAR(80),
    "prenom" VARCHAR(80),
    "sexe" "sexe" NOT NULL,
    "date_naissance" DATE NOT NULL,
    "lieu_naissance" VARCHAR(100),
    "nationalite" VARCHAR(60),
    "telephone" VARCHAR(30),
    "email" VARCHAR(150),
    "adresse" VARCHAR(255),
    "nom_tuteur" VARCHAR(150),
    "telephone_tuteur" VARCHAR(30),
    "domaine_etude" VARCHAR(100) NOT NULL DEFAULT 'Assistant en pharmacie',
    "statut" "statut_etudiant" NOT NULL DEFAULT 'CANDIDAT',
    "est_importe" BOOLEAN NOT NULL DEFAULT false,
    "cree_par" UUID,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,
    "supprime_le" TIMESTAMPTZ(3),

    CONSTRAINT "etudiants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "etudiant_id" UUID NOT NULL,
    "annee_id" INTEGER NOT NULL,
    "classe_id" INTEGER NOT NULL,
    "institut_id" INTEGER NOT NULL,
    "type" "type_inscription" NOT NULL,
    "date_inscription" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annulee_le" TIMESTAMPTZ(3),
    "cree_par" UUID,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statuts_annuels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "etudiant_id" UUID NOT NULL,
    "annee_id" INTEGER NOT NULL,
    "etat" "etat_annuel" NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "statuts_annuels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences_matricule" (
    "id" SERIAL NOT NULL,
    "institut_id" INTEGER NOT NULL,
    "annee_id" INTEGER NOT NULL,
    "classe_id" INTEGER NOT NULL,
    "dernier_numero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequences_matricule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories_frais" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "libelle" VARCHAR(100) NOT NULL,
    "nature" "nature_frais" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_frais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "institut_id" INTEGER NOT NULL,
    "annee_id" INTEGER NOT NULL,
    "classe_id" INTEGER NOT NULL,
    "categorie_id" INTEGER NOT NULL,
    "libelle" VARCHAR(150) NOT NULL,
    "montant_total" DECIMAL(14,2) NOT NULL,
    "devise" "devise" NOT NULL DEFAULT 'USD',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_par" UUID,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "frais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tranches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "frais_id" UUID NOT NULL,
    "parent_id" UUID,
    "numero" INTEGER NOT NULL,
    "libelle" VARCHAR(100) NOT NULL,
    "montant" DECIMAL(14,2) NOT NULL,
    "echeance_le" DATE,

    CONSTRAINT "tranches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taux_change" (
    "id" SERIAL NOT NULL,
    "institut_id" INTEGER NOT NULL,
    "devise_source" "devise" NOT NULL,
    "devise_cible" "devise" NOT NULL,
    "taux" DECIMAL(18,6) NOT NULL,
    "valide_depuis" TIMESTAMPTZ(3) NOT NULL,
    "cree_par" UUID,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taux_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "institut_id" INTEGER NOT NULL,
    "annee_id" INTEGER NOT NULL,
    "etudiant_id" UUID NOT NULL,
    "inscription_id" UUID NOT NULL,
    "frais_id" UUID NOT NULL,
    "tranche_id" UUID,
    "montant" DECIMAL(14,2) NOT NULL,
    "devise" "devise" NOT NULL,
    "taux_change_id" INTEGER,
    "mode" "mode_paiement" NOT NULL DEFAULT 'ESPECES',
    "reference" VARCHAR(80),
    "statut" "statut_paiement" NOT NULL DEFAULT 'EN_ATTENTE',
    "paye_le" TIMESTAMPTZ(3) NOT NULL,
    "valide_le" TIMESTAMPTZ(3),
    "valide_par" UUID,
    "annule_le" TIMESTAMPTZ(3),
    "annule_par" UUID,
    "motif_annulation" VARCHAR(500),
    "cree_par" UUID,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recus" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero" VARCHAR(40) NOT NULL,
    "paiement_id" UUID NOT NULL,
    "statut" "statut_recu" NOT NULL DEFAULT 'VALIDE',
    "snapshot" JSONB NOT NULL,
    "remplace_par_id" UUID,
    "nombre_reimpressions" INTEGER NOT NULL DEFAULT 0,
    "genere_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "genere_par" UUID,

    CONSTRAINT "recus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instituts" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "sigle" VARCHAR(20),
    "adresse" VARCHAR(255),
    "telephone" VARCHAR(30),
    "email" VARCHAR(150),
    "logo_url" VARCHAR(500),
    "logo_id_public" VARCHAR(200),
    "est_principal" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,
    "supprime_le" TIMESTAMPTZ(3),

    CONSTRAINT "instituts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acces_instituts" (
    "utilisateur_id" UUID NOT NULL,
    "institut_id" INTEGER NOT NULL,
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acces_instituts_pkey" PRIMARY KEY ("utilisateur_id","institut_id")
);

-- CreateTable
CREATE TABLE "annees_scolaires" (
    "id" SERIAL NOT NULL,
    "institut_id" INTEGER NOT NULL,
    "libelle" VARCHAR(9) NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "est_active" BOOLEAN NOT NULL DEFAULT false,
    "est_cloturee" BOOLEAN NOT NULL DEFAULT false,
    "cloture_le" TIMESTAMPTZ(3),
    "cree_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "annees_scolaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "libelle" VARCHAR(60) NOT NULL,
    "ordre" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametres" (
    "id" SERIAL NOT NULL,
    "institut_id" INTEGER NOT NULL,
    "cle" VARCHAR(80) NOT NULL,
    "valeur" JSONB NOT NULL,
    "description" VARCHAR(255),
    "modifie_par" UUID,
    "modifie_le" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "parametres_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_nom_utilisateur_key" ON "utilisateurs"("nom_utilisateur");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_telephone_key" ON "utilisateurs"("telephone");

-- CreateIndex
CREATE INDEX "utilisateurs_institut_id_role_id_idx" ON "utilisateurs"("institut_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "comptes_etudiants_etudiant_id_key" ON "comptes_etudiants"("etudiant_id");

-- CreateIndex
CREATE UNIQUE INDEX "jetons_rafraichissement_empreinte_key" ON "jetons_rafraichissement"("empreinte");

-- CreateIndex
CREATE INDEX "jetons_rafraichissement_famille_id_idx" ON "jetons_rafraichissement"("famille_id");

-- CreateIndex
CREATE INDEX "jetons_rafraichissement_utilisateur_id_idx" ON "jetons_rafraichissement"("utilisateur_id");

-- CreateIndex
CREATE INDEX "jetons_rafraichissement_compte_etudiant_id_idx" ON "jetons_rafraichissement"("compte_etudiant_id");

-- CreateIndex
CREATE INDEX "jetons_rafraichissement_expire_le_idx" ON "jetons_rafraichissement"("expire_le");

-- CreateIndex
CREATE INDEX "journal_audit_utilisateur_id_cree_le_idx" ON "journal_audit"("utilisateur_id", "cree_le");

-- CreateIndex
CREATE INDEX "journal_audit_entite_entite_id_idx" ON "journal_audit"("entite", "entite_id");

-- CreateIndex
CREATE INDEX "journal_audit_action_cree_le_idx" ON "journal_audit"("action", "cree_le");

-- CreateIndex
CREATE INDEX "journal_audit_cree_le_idx" ON "journal_audit"("cree_le");

-- CreateIndex
CREATE UNIQUE INDEX "etudiants_matricule_key" ON "etudiants"("matricule");

-- CreateIndex
CREATE INDEX "etudiants_institut_id_matricule_idx" ON "etudiants"("institut_id", "matricule");

-- CreateIndex
CREATE INDEX "etudiants_nom_prenom_idx" ON "etudiants"("nom", "prenom");

-- CreateIndex
CREATE INDEX "inscriptions_institut_id_annee_id_classe_id_idx" ON "inscriptions"("institut_id", "annee_id", "classe_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscriptions_etudiant_id_annee_id_key" ON "inscriptions"("etudiant_id", "annee_id");

-- CreateIndex
CREATE UNIQUE INDEX "statuts_annuels_etudiant_id_annee_id_key" ON "statuts_annuels"("etudiant_id", "annee_id");

-- CreateIndex
CREATE UNIQUE INDEX "sequences_matricule_institut_id_annee_id_classe_id_key" ON "sequences_matricule"("institut_id", "annee_id", "classe_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_frais_code_key" ON "categories_frais"("code");

-- CreateIndex
CREATE INDEX "frais_institut_id_annee_id_classe_id_idx" ON "frais"("institut_id", "annee_id", "classe_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_frais_par_classe" ON "frais"("institut_id", "annee_id", "classe_id", "categorie_id", "libelle");

-- CreateIndex
CREATE INDEX "tranches_frais_id_idx" ON "tranches"("frais_id");

-- CreateIndex
CREATE INDEX "taux_change_institut_id_devise_source_devise_cible_valide_d_idx" ON "taux_change"("institut_id", "devise_source", "devise_cible", "valide_depuis");

-- CreateIndex
CREATE INDEX "paiements_institut_id_annee_id_etudiant_id_idx" ON "paiements"("institut_id", "annee_id", "etudiant_id");

-- CreateIndex
CREATE INDEX "paiements_etudiant_id_frais_id_idx" ON "paiements"("etudiant_id", "frais_id");

-- CreateIndex
CREATE INDEX "paiements_statut_paye_le_idx" ON "paiements"("statut", "paye_le");

-- CreateIndex
CREATE UNIQUE INDEX "recus_numero_key" ON "recus"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "recus_remplace_par_id_key" ON "recus"("remplace_par_id");

-- CreateIndex
CREATE INDEX "recus_paiement_id_idx" ON "recus"("paiement_id");

-- CreateIndex
CREATE UNIQUE INDEX "instituts_code_key" ON "instituts"("code");

-- CreateIndex
CREATE INDEX "acces_instituts_institut_id_idx" ON "acces_instituts"("institut_id");

-- CreateIndex
CREATE UNIQUE INDEX "annees_scolaires_institut_id_libelle_key" ON "annees_scolaires"("institut_id", "libelle");

-- CreateIndex
CREATE UNIQUE INDEX "classes_code_key" ON "classes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "parametres_institut_id_cle_key" ON "parametres"("institut_id", "cle");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_institut_id_fkey" FOREIGN KEY ("institut_id") REFERENCES "instituts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comptes_etudiants" ADD CONSTRAINT "comptes_etudiants_etudiant_id_fkey" FOREIGN KEY ("etudiant_id") REFERENCES "etudiants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jetons_rafraichissement" ADD CONSTRAINT "jetons_rafraichissement_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jetons_rafraichissement" ADD CONSTRAINT "jetons_rafraichissement_compte_etudiant_id_fkey" FOREIGN KEY ("compte_etudiant_id") REFERENCES "comptes_etudiants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etudiants" ADD CONSTRAINT "etudiants_institut_id_fkey" FOREIGN KEY ("institut_id") REFERENCES "instituts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_etudiant_id_fkey" FOREIGN KEY ("etudiant_id") REFERENCES "etudiants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_annee_id_fkey" FOREIGN KEY ("annee_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_institut_id_fkey" FOREIGN KEY ("institut_id") REFERENCES "instituts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statuts_annuels" ADD CONSTRAINT "statuts_annuels_etudiant_id_fkey" FOREIGN KEY ("etudiant_id") REFERENCES "etudiants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statuts_annuels" ADD CONSTRAINT "statuts_annuels_annee_id_fkey" FOREIGN KEY ("annee_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequences_matricule" ADD CONSTRAINT "sequences_matricule_institut_id_fkey" FOREIGN KEY ("institut_id") REFERENCES "instituts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequences_matricule" ADD CONSTRAINT "sequences_matricule_annee_id_fkey" FOREIGN KEY ("annee_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequences_matricule" ADD CONSTRAINT "sequences_matricule_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frais" ADD CONSTRAINT "frais_institut_id_fkey" FOREIGN KEY ("institut_id") REFERENCES "instituts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frais" ADD CONSTRAINT "frais_annee_id_fkey" FOREIGN KEY ("annee_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frais" ADD CONSTRAINT "frais_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frais" ADD CONSTRAINT "frais_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categories_frais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tranches" ADD CONSTRAINT "tranches_frais_id_fkey" FOREIGN KEY ("frais_id") REFERENCES "frais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tranches" ADD CONSTRAINT "tranches_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tranches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taux_change" ADD CONSTRAINT "taux_change_institut_id_fkey" FOREIGN KEY ("institut_id") REFERENCES "instituts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_institut_id_fkey" FOREIGN KEY ("institut_id") REFERENCES "instituts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_annee_id_fkey" FOREIGN KEY ("annee_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_etudiant_id_fkey" FOREIGN KEY ("etudiant_id") REFERENCES "etudiants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_frais_id_fkey" FOREIGN KEY ("frais_id") REFERENCES "frais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_tranche_id_fkey" FOREIGN KEY ("tranche_id") REFERENCES "tranches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_taux_change_id_fkey" FOREIGN KEY ("taux_change_id") REFERENCES "taux_change"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recus" ADD CONSTRAINT "recus_paiement_id_fkey" FOREIGN KEY ("paiement_id") REFERENCES "paiements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recus" ADD CONSTRAINT "recus_remplace_par_id_fkey" FOREIGN KEY ("remplace_par_id") REFERENCES "recus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_instituts" ADD CONSTRAINT "acces_instituts_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_instituts" ADD CONSTRAINT "acces_instituts_institut_id_fkey" FOREIGN KEY ("institut_id") REFERENCES "instituts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annees_scolaires" ADD CONSTRAINT "annees_scolaires_institut_id_fkey" FOREIGN KEY ("institut_id") REFERENCES "instituts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametres" ADD CONSTRAINT "parametres_institut_id_fkey" FOREIGN KEY ("institut_id") REFERENCES "instituts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

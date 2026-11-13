-- CreateEnum
CREATE TYPE "decision_passage" AS ENUM ('PASSAGE', 'REDOUBLEMENT', 'REPRISE');

-- AlterTable
ALTER TABLE "inscriptions" ADD COLUMN     "decision" "decision_passage";

-- Une seule annee scolaire ACTIVE par institut.
-- (Prisma ne sait pas exprimer un index partiel : on l'ajoute ici, a la main, dans la migration.)
CREATE UNIQUE INDEX "uq_annee_active_par_institut" ON "annees_scolaires" ("institut_id") WHERE "est_active" = true;

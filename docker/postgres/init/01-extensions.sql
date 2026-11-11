-- Exécuté UNE SEULE FOIS, à la première création du volume de données.

-- pgcrypto : fonctions de hachage / aléatoire côté base (gen_random_uuid, digest...)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- citext : texte insensible à la casse. Idéal pour email / nom d'utilisateur
-- (« Marcelo@x.com » et « marcelo@x.com » deviennent le même identifiant).
CREATE EXTENSION IF NOT EXISTS "citext";

-- unaccent : ignore les accents dans les recherches (« Éthiopie » = « Ethiopie »).
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- pg_trgm : recherche floue + index rapides pour les recherches partielles
-- (nom d'étudiant, matricule...). Essentiel avec des milliers d'étudiants.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
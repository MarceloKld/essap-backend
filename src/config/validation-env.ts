import * as Joi from 'joi';

/**
 * Schéma de validation des variables d'environnement.
 *
 * Pourquoi c'est important : si une variable manque ou est mal formée,
 * l'application REFUSE de démarrer, avec un message clair. On évite ainsi
 * de découvrir le problème en production, en pleine inscription d'étudiants.
 */
export const schemaEnv = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(4000),
  FRONTEND_URL: Joi.string().uri().required(),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
});
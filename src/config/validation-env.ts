import Joi from 'joi';

/**
 * SchÃ©ma de validation des variables d'environnement.
 *
 * Pourquoi c'est important : si une variable manque ou est mal formÃ©e,
 * l'application REFUSE de dÃ©marrer, avec un message clair. On Ã©vite ainsi
 * de dÃ©couvrir le problÃ¨me en production, en pleine inscription d'Ã©tudiants.
 */
export const schemaEnv = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(4000),
  FRONTEND_URL: Joi.string().uri().required(),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
});
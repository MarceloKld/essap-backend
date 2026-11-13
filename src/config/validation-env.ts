import Joi from 'joi';

/**
 * Validation des variables d'environnement : l'application refuse de démarrer
 * si une valeur manque ou est mal formée.
 */
export const schemaEnv = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(4000),
  FRONTEND_URL: Joi.string().uri().required(),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),

  // --- Authentification ---
  JWT_ACCES_SECRET: Joi.string().min(32).required(),
  JWT_ACCES_DUREE_SECONDES: Joi.number().integer().min(60).max(3600).default(900),
  REFRESH_DUREE_JOURS: Joi.number().integer().min(1).max(30).default(7),
  COOKIES_SECURISES: Joi.boolean().default(false),

  // --- Cloudinary : facultatif au démarrage. S'il manque, seul l'envoi de logo répond 503. ---
  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').default(''),
  CLOUDINARY_API_KEY: Joi.string().allow('').default(''),
  CLOUDINARY_API_SECRET: Joi.string().allow('').default(''),
});
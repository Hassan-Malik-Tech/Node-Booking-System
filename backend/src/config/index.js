import 'dotenv/config';
import Joi from 'joi';
import deriveExpiresInSeconds from './deriveExpiresInSeconds.js';

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .trim()
    .valid('development', 'test', 'production')
    .default('development'),

  LOG_LEVEL: Joi.string()
    .trim()
    .valid('debug', 'info', 'warn', 'error')
    .default('info'),

  PORT: Joi.number().integer().port().required(),

  DATABASE_URL: Joi.string()
    .trim()
    .uri({ scheme: ['postgres', 'postgresql'] }) // scheme is the first part of a url before the ://
    .required(),

  BCRYPT_COST: Joi.number().integer().min(4).max(12).default(12),

  // HS256 is symmetric, so the same secret signs and verifies JWTs.
  // 32 characters is a practical minimum to avoid weak secrets like "secret".
  // In real environments, this should be randomly generated and stored outside the codebase.
  // HS256 should use at least a 256-bit (32 bytes) secret; use a randomly generated value.
  JWT_SECRET: Joi.string().trim().min(32).required(),

  JWT_EXPIRES_IN: Joi.string()
    .trim()
    .pattern(/^\d+[smhd]$/)
    .min(2)
    .required(),

  AUTH_RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1).required(),

  AUTH_RATE_LIMIT_MAX: Joi.number().integer().min(1).required(),
});

const rawConfig = {
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  BCRYPT_COST: process.env.BCRYPT_COST,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  AUTH_RATE_LIMIT_WINDOW_MS: process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX: process.env.AUTH_RATE_LIMIT_MAX,
};

const { value, error } = envSchema.validate(rawConfig, {
  abortEarly: false,
  convert: true, // default is true, wrote it just to make it explicit
});

if (error) {
  const messages = error.details.map((detail) => detail.message).join('; ');

  throw new Error(`Config validation failed: ${messages}`);
}

const config = {
  port: value.PORT,
  logLevel: value.LOG_LEVEL,
  env: value.NODE_ENV,
  databaseUrl: value.DATABASE_URL,
  bcryptCost: value.BCRYPT_COST,
  jwt: {
    secret: value.JWT_SECRET,
    expiresIn: value.JWT_EXPIRES_IN,
    expiresInSeconds: deriveExpiresInSeconds(value.JWT_EXPIRES_IN),
  },
  authRateLimit: {
    windowMs: value.AUTH_RATE_LIMIT_WINDOW_MS,
    max: value.AUTH_RATE_LIMIT_MAX,
  },
};

// State in the README that the test db must include the word "test"
if (config.env === 'test' && !config.databaseUrl.includes('test')) {
  throw new Error('Test environment must use a test database.');
}

// Object.freeze(...) only does shallow freezing, so I need to freeze nested objects as well
Object.freeze(config.jwt);
Object.freeze(config.authRateLimit);
Object.freeze(config);

export default config;

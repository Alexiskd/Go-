import { defineConfig } from '@go-/config';
import { s } from '@go-/shared';

/** Variables lues avec le préfixe `API_` (ex. API_PORT, API_JWT_SECRET). */
export const apiConfig = defineConfig(
  {
    port: s.number().int().min(0).max(65535).default(3000),
    host: s.string().default('0.0.0.0'),
    /** Obligatoire en production ; généré à la volée (avec avertissement) en développement. */
    jwtSecret: s.string().min(32).optional(),
    jwtExpiresIn: s.number().int().positive().default(3600),
    corsOrigins: s.array(s.string().url()).default([]),
    adminEmail: s.string().email().optional(),
    adminPassword: s.string().min(12).optional(),
    /** Coût scrypt (puissance de 2). */
    passwordCost: s.number().int().min(10).max(20).default(15),
    rateLimitPerMinute: s.number().int().positive().default(120),
  },
  { secrets: ['jwtSecret', 'adminPassword'] },
);

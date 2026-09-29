export interface AppConfig {
  port: number;
  databaseUrl: string;
  migrationsRun: boolean;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[] | true;
  admin: { email?: string; password?: string };
  sarvam: { apiKey?: string; model: string; baseUrl?: string };
  pipelineIntervalMinutes: number;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable ${key}`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === 'production';
  const jwtSecret =
    env.JWT_SECRET ??
    (production ? required(env, 'JWT_SECRET') : 'dev-only-insecure-secret');
  const cors = env.CORS_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl:
      env.DATABASE_URL ?? 'postgres://news:news@localhost:5432/news_hoster',
    migrationsRun: env.DB_MIGRATIONS_RUN !== 'false',
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? '12h',
    corsOrigins: cors?.length ? cors : true,
    admin: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD },
    sarvam: {
      apiKey: env.SARVAM_API_KEY || undefined,
      model: env.SARVAM_MODEL ?? 'sarvam-105b',
      baseUrl: env.SARVAM_BASE_URL || undefined,
    },
    pipelineIntervalMinutes: Number(env.PIPELINE_INTERVAL_MINUTES ?? 10),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

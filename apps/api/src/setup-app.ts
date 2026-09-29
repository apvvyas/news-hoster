import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { AppConfig } from './config/configuration.js';

/** Shared by main.ts and the e2e tests so both run the same HTTP stack. */
export function setupApp(
  app: INestApplication,
  config: AppConfig,
): INestApplication {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.corsOrigins });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('News Hoster API')
    .setDescription(
      'Admin endpoints (`/api/admin/*`) need a Bearer token from `/api/auth/login`. ' +
        'Public endpoints (`/api/public/*`) need a site key in the `x-api-key` header.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'site-key')
    .build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, doc),
  );
  return app;
}

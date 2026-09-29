import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { APP_CONFIG, type AppConfig } from './config/configuration.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);
  setupApp(app, config);
  await app.listen(config.port);
  Logger.log(
    `API on http://localhost:${config.port}/api  (docs: /api/docs)`,
    'Bootstrap',
  );
}
await bootstrap();

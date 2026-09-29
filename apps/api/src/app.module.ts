import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticlesModule } from './articles/articles.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ConfigModule } from './config/config.module.js';
import { APP_CONFIG, type AppConfig } from './config/configuration.js';
import { dataSourceOptions } from './database/data-source.js';
import { FeedsModule } from './feeds/feeds.module.js';
import { HealthController } from './health/health.controller.js';
import { PipelineModule } from './pipeline/pipeline.module.js';
import { PublicModule } from './public/public.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { SitesModule } from './sites/sites.module.js';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        ...dataSourceOptions(config.databaseUrl),
        migrationsRun: config.migrationsRun,
      }),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 600) },
    ]),
    AuthModule,
    CategoriesModule,
    FeedsModule,
    SitesModule,
    SettingsModule,
    ArticlesModule,
    PipelineModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module.js';
import { APP_CONFIG, type AppConfig } from '../config/configuration.js';
import { Article, ArticleTranslation } from './article.entity.js';
import { ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';
import { ArticleChatMessage } from './chat-message.entity.js';
import { EDITOR_ASSISTANT, SarvamEditorAssistant } from './editor-assistant.js';
import { EditorialChatService } from './editorial-chat.service.js';
import { ArticleRevision } from './revision.entity.js';
import { RevisionsService } from './revisions.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Article,
      ArticleTranslation,
      ArticleRevision,
      ArticleChatMessage,
    ]),
    CategoriesModule,
  ],
  controllers: [ArticlesController],
  providers: [
    ArticlesService,
    RevisionsService,
    EditorialChatService,
    {
      provide: EDITOR_ASSISTANT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.sarvam.apiKey
          ? SarvamEditorAssistant.create(
              config.sarvam.apiKey,
              config.sarvam.model,
              config.sarvam.baseUrl,
            )
          : null,
    },
  ],
  exports: [ArticlesService, RevisionsService, TypeOrmModule],
})
export class ArticlesModule {}

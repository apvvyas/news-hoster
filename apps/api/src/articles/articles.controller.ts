import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AdminAuth,
  CurrentUser,
  type AuthUser,
} from '../auth/auth.decorators.js';
import type { Paginated } from '../common/pagination.js';
import { Article } from './article.entity.js';
import {
  AdminArticlesQuery,
  BulkStatusDto,
  ChatMessageDto,
  LanguageQuery,
  UpdateArticleDto,
} from './articles.dto.js';
import { ArticlesService } from './articles.service.js';
import { ArticleChatMessage } from './chat-message.entity.js';
import { EditorialChatService } from './editorial-chat.service.js';
import { ArticleRevision } from './revision.entity.js';
import { RevisionsService } from './revisions.service.js';

@ApiTags('admin: articles')
@Controller('admin/articles')
@AdminAuth()
export class ArticlesController {
  constructor(
    private readonly articles: ArticlesService,
    private readonly revisions: RevisionsService,
    private readonly chat: EditorialChatService,
  ) {}

  @Get()
  list(@Query() q: AdminArticlesQuery): Promise<Paginated<Article>> {
    return this.articles.list(q);
  }

  /** Counts per status, for the "All | Published | Draft | Trash" links. */
  @Get('counts')
  counts(): Promise<Record<string, number>> {
    return this.articles.statusCounts();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Article> {
    return this.articles.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Article> {
    return this.articles.update(id, dto, user.id);
  }

  @Post('bulk-status')
  @HttpCode(200)
  bulkStatus(@Body() dto: BulkStatusDto): Promise<{ updated: number }> {
    return this.articles.bulkStatus(dto);
  }

  @Delete(':id/translations/:language')
  removeTranslation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('language') language: string,
  ): Promise<Article> {
    return this.articles.removeTranslation(id, language);
  }

  /** Permanently delete (the article must be in the trash). */
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.articles.remove(id);
  }

  // ---- Revisions ----------------------------------------------------------------

  @Get(':id/revisions')
  listRevisions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: LanguageQuery,
  ): Promise<ArticleRevision[]> {
    return this.revisions.list(id, q.language);
  }

  @Post(':id/revisions/:revisionId/restore')
  @HttpCode(200)
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('revisionId', ParseUUIDPipe) revisionId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Article> {
    return this.articles.restoreRevision(id, revisionId, user.id);
  }

  // ---- Editorial chat (per language version) --------------------------------------

  @Get(':id/chat')
  async chatHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: LanguageQuery,
  ) {
    return {
      available: this.chat.available,
      messages: q.language ? await this.chat.list(id, q.language) : [],
    };
  }

  /** Send a message to the assistant; returns the stored user message and the assistant's reply. */
  @Post(':id/chat')
  @HttpCode(200)
  sendChat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChatMessageDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ArticleChatMessage[]> {
    return this.chat.send(id, dto.language, dto.message, user.id);
  }

  /** Apply the proposal carried by an assistant message (creates a revision). */
  @Post(':id/chat/:messageId/apply')
  @HttpCode(200)
  applyChat(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ArticleChatMessage> {
    return this.chat.apply(id, messageId, user.id);
  }
}

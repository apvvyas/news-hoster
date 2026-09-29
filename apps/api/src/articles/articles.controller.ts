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
} from '@nestjs/common';
import { Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuth } from '../auth/auth.decorators.js';
import type { Paginated } from '../common/pagination.js';
import { Article } from './article.entity.js';
import {
  AdminArticlesQuery,
  BulkStatusDto,
  UpdateArticleDto,
} from './articles.dto.js';
import { ArticlesService } from './articles.service.js';

@ApiTags('admin: articles')
@Controller('admin/articles')
@AdminAuth()
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  list(@Query() q: AdminArticlesQuery): Promise<Paginated<Article>> {
    return this.articles.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Article> {
    return this.articles.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
  ): Promise<Article> {
    return this.articles.update(id, dto);
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

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.articles.remove(id);
  }
}

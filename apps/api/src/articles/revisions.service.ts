import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from '../users/user.entity.js';
import {
  Article,
  versionContent,
  type ArticleTranslation,
} from './article.entity.js';
import { ArticleRevision } from './revision.entity.js';

@Injectable()
export class RevisionsService {
  constructor(
    @InjectRepository(ArticleRevision)
    private readonly repo: Repository<ArticleRevision>,
  ) {}

  /** Record the current state of a language version. Pass a transaction's manager to join it. */
  snapshot(
    article: Article,
    t: ArticleTranslation,
    note: string,
    authorId: string | null,
    manager: EntityManager = this.repo.manager,
  ): Promise<ArticleRevision> {
    return manager.save(
      manager.create(ArticleRevision, {
        article: { id: article.id },
        language: t.language,
        content: versionContent(t),
        note,
        author: authorId ? ({ id: authorId } as User) : null,
      }),
    );
  }

  list(articleId: string, language?: string): Promise<ArticleRevision[]> {
    return this.repo.find({
      where: language
        ? { article: { id: articleId }, language }
        : { article: { id: articleId } },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async get(articleId: string, revisionId: string): Promise<ArticleRevision> {
    const rev = await this.repo.findOneBy({
      id: revisionId,
      article: { id: articleId },
    });
    if (!rev) throw new NotFoundException('Revision not found');
    return rev;
  }
}

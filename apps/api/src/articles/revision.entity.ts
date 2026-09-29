import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';
import { Article, type VersionContent } from './article.entity.js';

/** A snapshot of one language version of an article, taken on every change (like WordPress revisions). */
@Entity('article_revisions')
@Index(['article', 'language', 'createdAt'])
export class ArticleRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Article, { onDelete: 'CASCADE' })
  article: Article;

  @Column()
  language: string;

  @Column({ type: 'jsonb' })
  content: VersionContent;

  /** Who made it: a user, or null for the pipeline. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: true })
  author: User | null;

  /** e.g. 'Created by sarvam:sarvam-105b', 'Edited', 'Applied assistant suggestion', 'Restored revision'. */
  @Column()
  note: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

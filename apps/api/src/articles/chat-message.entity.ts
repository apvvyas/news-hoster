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

export enum ChatRole {
  User = 'user',
  Assistant = 'assistant',
}

/** One message in the editorial chat for a language version of an article. */
@Entity('article_chat_messages')
@Index(['article', 'language', 'createdAt'])
export class ArticleChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Article, { onDelete: 'CASCADE' })
  article: Article;

  @Column()
  language: string;

  @Column({ type: 'enum', enum: ChatRole })
  role: ChatRole;

  @Column({ type: 'text' })
  content: string;

  /** Assistant messages may carry a full proposed version the editor can apply. */
  @Column({ type: 'jsonb', nullable: true })
  proposal: VersionContent | null;

  /** Set once the proposal was applied (the revision it produced). */
  @Column({ type: 'uuid', nullable: true })
  appliedRevisionId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: true })
  author: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

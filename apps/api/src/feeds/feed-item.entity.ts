import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Feed } from './feed.entity.js';

export enum ItemStatus {
  Pending = 'pending',
  Done = 'done',
  Duplicate = 'duplicate',
  Failed = 'failed',
  Skipped = 'skipped',
}

/** A story exactly as it arrived from a source feed (untrusted third-party content). */
@Entity('feed_items')
export class FeedItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Feed, { onDelete: 'CASCADE', eager: true })
  feed: Feed;

  @Column({ unique: true })
  url: string;

  @Column({ type: 'varchar', nullable: true })
  guid: string | null;

  @Column()
  title: string;

  @Index()
  @Column()
  titleKey: string;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ type: 'varchar', nullable: true })
  author: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  @Column()
  language: string;

  @Column({ type: 'timestamptz' })
  publishedAt: Date;

  @Index()
  @Column({ type: 'enum', enum: ItemStatus, default: ItemStatus.Pending })
  status: ItemStatus;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'varchar', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

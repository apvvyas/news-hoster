import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity.js';

/** One of our public websites. Each consumes the public API with its own key. */
@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  domain: string | null;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ default: 'en' })
  defaultLanguage: string;

  /** Languages this site serves. */
  @Column({ type: 'jsonb', default: () => `'["en"]'` })
  languages: string[];

  /** Categories shown on this site. Empty = all categories. */
  @ManyToMany(() => Category, { eager: true })
  @JoinTable({ name: 'site_categories' })
  categories: Category[];

  /** SHA-256 of the API key; the key itself is only shown once. */
  @Index({ unique: true })
  @Column({ select: false })
  apiKeyHash: string;

  /** First characters of the key, so admins can tell keys apart. */
  @Column()
  apiKeyPrefix: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

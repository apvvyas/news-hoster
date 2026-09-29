import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  /** Display name per language, e.g. { en: 'Sports', hi: 'खेल' }. `en` is required. */
  @Column({ type: 'jsonb' })
  names: Record<string, string>;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

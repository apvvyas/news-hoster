import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity.js';

@Entity('feeds')
export class Feed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  url: string;

  /** 'en' | 'hi', or 'auto' to detect per story. */
  @Column({ default: 'auto' })
  language: string;

  /** Hint for the restructurer; the model may re-classify. */
  @ManyToOne(() => Category, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  defaultCategory: Category | null;

  @Column({ default: true })
  active: boolean;

  @Column({ default: 30 })
  fetchIntervalMinutes: number;

  @Column({ type: 'varchar', nullable: true })
  etag: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastModified: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastFetchedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

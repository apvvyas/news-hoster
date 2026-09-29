import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum RestructureEngine {
  Auto = 'auto', // Sarvam if SARVAM_API_KEY is set, otherwise extractive
  Sarvam = 'sarvam',
  Extractive = 'extractive',
}

/** Single-row table (id = 1) holding editable pipeline settings. */
@Entity('settings')
export class Settings {
  @PrimaryColumn({ default: 1 })
  id: number;

  /** Publish restructured articles immediately, or hold them as drafts for review. */
  @Column({ default: false })
  autoPublish: boolean;

  @Column({
    type: 'enum',
    enum: RestructureEngine,
    default: RestructureEngine.Auto,
  })
  engine: RestructureEngine;

  /** Every article is produced in each of these languages. */
  @Column({ type: 'jsonb', default: () => `'["en", "hi"]'` })
  targetLanguages: string[];

  /** Max stories restructured per pipeline run. */
  @Column({ default: 25 })
  batchSize: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

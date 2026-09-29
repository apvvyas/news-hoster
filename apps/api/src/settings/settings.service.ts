import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APP_CONFIG, type AppConfig } from '../config/configuration.js';
import { RestructureEngine, Settings } from './settings.entity.js';
import type { UpdateSettingsDto } from './settings.dto.js';

export interface SettingsView extends Settings {
  /** The engine actually used once 'auto' is resolved. */
  effectiveEngine: Exclude<RestructureEngine, RestructureEngine.Auto>;
  sarvamConfigured: boolean;
  sarvamModel: string;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings) private readonly repo: Repository<Settings>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async get(): Promise<Settings> {
    const existing = await this.repo.findOneBy({ id: 1 });
    if (existing) return existing;
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ id: 1 })
      .orIgnore()
      .execute();
    return this.repo.findOneByOrFail({ id: 1 });
  }

  async view(): Promise<SettingsView> {
    const s = await this.get();
    return {
      ...s,
      effectiveEngine: this.effectiveEngine(s),
      sarvamConfigured: Boolean(this.config.sarvam.apiKey),
      sarvamModel: this.config.sarvam.model,
    };
  }

  effectiveEngine(
    s: Settings,
  ): Exclude<RestructureEngine, RestructureEngine.Auto> {
    if (s.engine !== RestructureEngine.Auto) return s.engine;
    return this.config.sarvam.apiKey
      ? RestructureEngine.Sarvam
      : RestructureEngine.Extractive;
  }

  async update(dto: UpdateSettingsDto): Promise<SettingsView> {
    const s = await this.get();
    Object.assign(s, dto);
    await this.repo.save(s);
    return this.view();
  }
}

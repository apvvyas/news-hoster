import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { In, Repository } from 'typeorm';
import { Category } from '../categories/category.entity.js';
import { Site } from './site.entity.js';
import type { CreateSiteDto, UpdateSiteDto } from './sites.dto.js';

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site) private readonly repo: Repository<Site>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  list(): Promise<Site[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async get(id: string): Promise<Site> {
    const site = await this.repo.findOneBy({ id });
    if (!site) throw new NotFoundException('Site not found');
    return site;
  }

  findByApiKey(key: string): Promise<Site | null> {
    return this.repo.findOneBy({ apiKeyHash: hashApiKey(key), active: true });
  }

  async create(dto: CreateSiteDto): Promise<{ site: Site; apiKey: string }> {
    this.checkLanguages(dto.defaultLanguage, dto.languages);
    if (await this.repo.existsBy({ slug: dto.slug }))
      throw new ConflictException('Slug already in use');
    const apiKey = this.newKey();
    const site = this.repo.create({
      name: dto.name,
      slug: dto.slug,
      domain: dto.domain ?? null,
      description: dto.description ?? '',
      defaultLanguage: dto.defaultLanguage,
      languages: dto.languages,
      categories: await this.resolveCategories(dto.categoryIds),
      active: dto.active ?? true,
      apiKeyHash: hashApiKey(apiKey),
      apiKeyPrefix: apiKey.slice(0, 12),
    });
    const saved = await this.repo.save(site);
    return { site: await this.get(saved.id), apiKey };
  }

  async update(id: string, dto: UpdateSiteDto): Promise<Site> {
    const site = await this.get(id);
    if (dto.slug && dto.slug !== site.slug) {
      if (await this.repo.existsBy({ slug: dto.slug }))
        throw new ConflictException('Slug already in use');
      site.slug = dto.slug;
    }
    this.checkLanguages(
      dto.defaultLanguage ?? site.defaultLanguage,
      dto.languages ?? site.languages,
    );
    if (dto.name !== undefined) site.name = dto.name;
    if (dto.domain !== undefined) site.domain = dto.domain;
    if (dto.description !== undefined) site.description = dto.description;
    if (dto.defaultLanguage !== undefined)
      site.defaultLanguage = dto.defaultLanguage;
    if (dto.languages !== undefined) site.languages = dto.languages;
    if (dto.active !== undefined) site.active = dto.active;
    if (dto.categoryIds !== undefined)
      site.categories = await this.resolveCategories(dto.categoryIds);
    await this.repo.save(site);
    return this.get(id);
  }

  async rotateKey(id: string): Promise<{ site: Site; apiKey: string }> {
    await this.get(id);
    const apiKey = this.newKey();
    await this.repo.update(id, {
      apiKeyHash: hashApiKey(apiKey),
      apiKeyPrefix: apiKey.slice(0, 12),
    });
    return { site: await this.get(id), apiKey };
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Site not found');
  }

  private newKey(): string {
    return `nh_live_${randomBytes(24).toString('base64url')}`;
  }

  private checkLanguages(defaultLanguage: string, languages: string[]) {
    if (!languages.includes(defaultLanguage))
      throw new BadRequestException('defaultLanguage must be one of languages');
  }

  private async resolveCategories(
    ids: string[] | undefined,
  ): Promise<Category[]> {
    if (!ids?.length) return [];
    const found = await this.categories.findBy({ id: In(ids) });
    if (found.length !== new Set(ids).size)
      throw new BadRequestException('Unknown category id');
    return found;
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isLanguage } from '../common/languages.js';
import { Category } from './category.entity.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './categories.dto.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly repo: Repository<Category>,
  ) {}

  list(): Promise<Category[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', slug: 'ASC' } });
  }

  async get(id: string): Promise<Category> {
    const c = await this.repo.findOneBy({ id });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  findBySlug(slug: string): Promise<Category | null> {
    return this.repo.findOneBy({ slug });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    this.validateNames(dto.names);
    if (await this.repo.existsBy({ slug: dto.slug }))
      throw new ConflictException('Slug already in use');
    return this.repo.save(
      this.repo.create({
        slug: dto.slug,
        names: dto.names,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const c = await this.get(id);
    if (dto.names) {
      this.validateNames(dto.names);
      c.names = dto.names;
    }
    if (dto.slug && dto.slug !== c.slug) {
      if (await this.repo.existsBy({ slug: dto.slug }))
        throw new ConflictException('Slug already in use');
      c.slug = dto.slug;
    }
    if (dto.sortOrder !== undefined) c.sortOrder = dto.sortOrder;
    return this.repo.save(c);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Category not found');
  }

  private validateNames(names: Record<string, string>) {
    if (!names.en?.trim())
      throw new BadRequestException('names.en is required');
    for (const [lang, value] of Object.entries(names)) {
      if (!isLanguage(lang))
        throw new BadRequestException(`Unsupported language "${lang}"`);
      if (typeof value !== 'string' || !value.trim())
        throw new BadRequestException(
          `names.${lang} must be a non-empty string`,
        );
    }
  }
}

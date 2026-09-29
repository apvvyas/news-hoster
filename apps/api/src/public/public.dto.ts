import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LANGUAGES } from '../common/languages.js';
import { PaginationQuery } from '../common/pagination.js';

export class LangQuery {
  @ApiPropertyOptional({
    enum: LANGUAGES,
    description: "Defaults to the site's default language",
  })
  @IsOptional()
  @IsIn(LANGUAGES)
  lang?: string;
}

export class PublicArticlesQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES)
  lang?: string;
  @ApiPropertyOptional({ description: 'Category slug' })
  @IsOptional()
  @IsString()
  category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tag?: string;
  @ApiPropertyOptional({ description: 'Search headlines' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class PublicCategory {
  @ApiProperty() slug: string;
  @ApiProperty() name: string;
}

export class PublicSource {
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, type: String }) url: string | null;
}

export class PublicArticle {
  @ApiProperty() id: string;
  @ApiProperty() slug: string;
  @ApiProperty({ enum: LANGUAGES }) language: string;
  @ApiProperty({ enum: LANGUAGES, isArray: true }) availableLanguages: string[];
  @ApiProperty() headline: string;
  @ApiProperty() summary: string;
  @ApiProperty({ type: [String] }) keyPoints: string[];
  @ApiProperty({ type: PublicCategory, nullable: true })
  category: PublicCategory | null;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty({ nullable: true, type: String }) imageUrl: string | null;
  @ApiProperty({ type: PublicSource }) source: PublicSource;
  @ApiProperty() publishedAt: Date;
}

export class PublicArticleDetail extends PublicArticle {
  @ApiProperty({ type: [PublicArticle] }) related: PublicArticle[];
}

export class PublicArticlePage {
  @ApiProperty({ type: [PublicArticle] }) items: PublicArticle[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
}

export class PublicSiteInfo {
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ nullable: true, type: String }) domain: string | null;
  @ApiProperty() description: string;
  @ApiProperty({ enum: LANGUAGES }) defaultLanguage: string;
  @ApiProperty({ enum: LANGUAGES, isArray: true }) languages: string[];
  @ApiProperty({ type: [PublicCategory] }) categories: PublicCategory[];
}

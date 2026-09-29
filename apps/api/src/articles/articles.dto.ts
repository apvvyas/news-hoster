import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LANGUAGES } from '../common/languages.js';
import { PaginationQuery } from '../common/pagination.js';
import { ArticleStatus } from './article.entity.js';

export class AdminArticlesQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: ArticleStatus })
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional({
    enum: LANGUAGES,
    description: 'Filter by source language',
  })
  @IsOptional()
  @IsIn(LANGUAGES)
  sourceLanguage?: string;
  @ApiPropertyOptional({ description: 'Search headlines (any language)' })
  @IsOptional()
  @IsString()
  q?: string;
}

export class TranslationDto {
  @ApiProperty({ enum: LANGUAGES }) @IsIn(LANGUAGES) language: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) headline: string;
  @ApiProperty() @IsString() @MinLength(1) summary: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  keyPoints: string[];
}

export class UpdateArticleDto {
  @ApiPropertyOptional({ enum: ArticleStatus })
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() categoryId?:
    string | null;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() imageUrl?:
    string | null;

  @ApiPropertyOptional({
    type: [TranslationDto],
    description: 'Upserts the given languages; others are kept',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  translations?: TranslationDto[];
}

export class BulkStatusDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  ids: string[];
  @ApiProperty({ enum: ArticleStatus })
  @IsEnum(ArticleStatus)
  status: ArticleStatus;
}

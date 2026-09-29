import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { LANGUAGES } from '../common/languages.js';

export class CreateSiteDto {
  @ApiProperty({ example: 'Hindi Samachar' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'hindi-samachar' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(60)
  slug: string;

  @ApiPropertyOptional({ example: 'hindisamachar.example.com', nullable: true })
  @IsOptional()
  @IsString()
  domain?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: LANGUAGES }) @IsIn(LANGUAGES) defaultLanguage: string;

  @ApiProperty({ enum: LANGUAGES, isArray: true, example: ['hi', 'en'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(LANGUAGES, { each: true })
  languages: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Category ids shown on the site; empty = all',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateSiteDto extends PartialType(CreateSiteDto) {}

export class SiteWithKey {
  @ApiProperty({ description: 'The site record' }) site: object;
  @ApiProperty({
    description:
      'Plain API key. Shown only once — store it in the website config.',
  })
  apiKey: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { LANGUAGES } from '../common/languages.js';
import { RestructureEngine } from './settings.entity.js';

export class UpdateSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoPublish?: boolean;

  @ApiPropertyOptional({ enum: RestructureEngine })
  @IsOptional()
  @IsEnum(RestructureEngine)
  engine?: RestructureEngine;

  @ApiPropertyOptional({ enum: LANGUAGES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(LANGUAGES, { each: true })
  targetLanguages?: string[];

  @ApiPropertyOptional({ minimum: 1, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  batchSize?: number;
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { AdminAuth } from '../auth/auth.decorators.js';
import { DashboardService, type Dashboard } from './dashboard.service.js';
import { PipelineService, type PipelineRun } from './pipeline.service.js';

class RunPipelineDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  fetch?: boolean;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  restructure?: boolean;
}

@ApiTags('admin: pipeline')
@Controller('admin')
@AdminAuth()
export class PipelineController {
  constructor(
    private readonly pipeline: PipelineService,
    private readonly dashboard: DashboardService,
  ) {}

  @Get('dashboard')
  getDashboard(): Promise<Dashboard> {
    return this.dashboard.get();
  }

  @Get('pipeline/status')
  status() {
    return { running: this.pipeline.isRunning, lastRun: this.pipeline.lastRun };
  }

  /** Fetch all due feeds and restructure a batch now. */
  @Post('pipeline/run')
  @HttpCode(200)
  run(@Body() dto: RunPipelineDto): Promise<PipelineRun> {
    return this.pipeline.run(dto);
  }

  /** Fetch one feed immediately (ignores its interval). New stories are restructured by the next run. */
  @Post('feeds/:id/fetch')
  @HttpCode(200)
  fetchFeed(@Param('id', ParseUUIDPipe) id: string): Promise<PipelineRun> {
    return this.pipeline.run({ feedIds: [id], restructure: false });
  }
}

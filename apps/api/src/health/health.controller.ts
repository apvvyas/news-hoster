import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DataSource) {}

  @Get()
  async check() {
    await this.db.query('SELECT 1');
    return { status: 'ok' };
  }
}

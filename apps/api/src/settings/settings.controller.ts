import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuth } from '../auth/auth.decorators.js';
import { Role } from '../users/user.entity.js';
import { UpdateSettingsDto } from './settings.dto.js';
import { SettingsService, type SettingsView } from './settings.service.js';

@ApiTags('admin: settings')
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @AdminAuth()
  get(): Promise<SettingsView> {
    return this.settings.view();
  }

  @Patch()
  @AdminAuth(Role.Admin)
  update(@Body() dto: UpdateSettingsDto): Promise<SettingsView> {
    return this.settings.update(dto);
  }
}

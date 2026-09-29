import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminAuth } from '../auth/auth.decorators.js';
import { Role } from '../users/user.entity.js';
import { Site } from './site.entity.js';
import { CreateSiteDto, SiteWithKey, UpdateSiteDto } from './sites.dto.js';
import { SitesService } from './sites.service.js';

@ApiTags('admin: sites')
@Controller('admin/sites')
@AdminAuth(Role.Admin)
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  list(): Promise<Site[]> {
    return this.sites.list();
  }

  @Post()
  @ApiCreatedResponse({ type: SiteWithKey })
  create(@Body() dto: CreateSiteDto) {
    return this.sites.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteDto,
  ): Promise<Site> {
    return this.sites.update(id, dto);
  }

  @Post(':id/rotate-key')
  @HttpCode(200)
  @ApiOkResponse({ type: SiteWithKey })
  rotateKey(@Param('id', ParseUUIDPipe) id: string) {
    return this.sites.rotateKey(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.sites.remove(id);
  }
}

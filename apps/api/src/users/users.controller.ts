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
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AdminAuth,
  CurrentUser,
  type AuthUser,
} from '../auth/auth.decorators.js';
import { Role } from './user.entity.js';
import { CreateUserDto, UpdateUserDto, UserView } from './users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('admin: users')
@Controller('admin/users')
@AdminAuth(Role.Admin)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOkResponse({ type: [UserView] })
  async list(): Promise<UserView[]> {
    return (await this.users.list()).map((u) => this.users.toView(u));
  }

  @Post()
  @ApiOkResponse({ type: UserView })
  async create(@Body() dto: CreateUserDto): Promise<UserView> {
    return this.users.toView(await this.users.create(dto));
  }

  @Patch(':id')
  @ApiOkResponse({ type: UserView })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() me: AuthUser,
  ): Promise<UserView> {
    return this.users.toView(await this.users.update(id, dto, me.id));
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() me: AuthUser,
  ): Promise<void> {
    return this.users.remove(id, me.id);
  }
}

import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserView } from '../users/users.dto.js';
import { UsersService } from '../users/users.service.js';
import { AdminAuth, CurrentUser, type AuthUser } from './auth.decorators.js';
import { LoginDto, LoginResponse } from './auth.dto.js';
import { AuthService } from './auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ type: LoginResponse })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @AdminAuth()
  @ApiOkResponse({ type: UserView })
  async me(@CurrentUser() user: AuthUser): Promise<UserView> {
    return this.users.toView(await this.users.get(user.id));
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { UserView } from '../users/users.dto.js';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}

export class LoginResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: UserView })
  user: UserView;
}

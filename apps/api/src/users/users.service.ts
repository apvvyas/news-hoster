import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { APP_CONFIG, type AppConfig } from '../config/configuration.js';
import { Role, User } from './user.entity.js';
import type { CreateUserDto, UpdateUserDto, UserView } from './users.dto.js';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly log = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when the users table is empty. */
  async onApplicationBootstrap() {
    const { email, password } = this.config.admin;
    if (!email || !password || (await this.repo.count()) > 0) return;
    await this.create({
      email,
      password,
      name: 'Administrator',
      role: Role.Admin,
    });
    this.log.log(`Created initial admin user ${email}`);
  }

  toView(u: User): UserView {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      active: u.active,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    };
  }

  list(): Promise<User[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async get(id: string): Promise<User> {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findActive(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id, active: true });
  }

  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('lower(u.email) = lower(:email) AND u.active', { email })
      .getOne();
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return null;
    await this.repo.update(user.id, { lastLoginAt: new Date() });
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.toLowerCase();
    if (await this.repo.existsBy({ email }))
      throw new ConflictException('Email already in use');
    const user = this.repo.create({
      email,
      name: dto.name,
      role: dto.role,
      passwordHash: await bcrypt.hash(dto.password, 12),
    });
    return this.repo.save(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actingUserId: string,
  ): Promise<User> {
    const user = await this.get(id);
    if (
      id === actingUserId &&
      (dto.active === false || (dto.role && dto.role !== Role.Admin))
    ) {
      throw new BadRequestException('You cannot deactivate or demote yourself');
    }
    if (dto.email && dto.email.toLowerCase() !== user.email) {
      if (await this.repo.existsBy({ email: dto.email.toLowerCase() }))
        throw new ConflictException('Email already in use');
      user.email = dto.email.toLowerCase();
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.active !== undefined) user.active = dto.active;
    if (dto.password) user.passwordHash = await bcrypt.hash(dto.password, 12);
    return this.repo.save(user);
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    if (id === actingUserId)
      throw new BadRequestException('You cannot delete yourself');
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('User not found');
  }
}

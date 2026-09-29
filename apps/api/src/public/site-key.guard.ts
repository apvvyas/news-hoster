import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Site } from '../sites/site.entity.js';
import { SitesService } from '../sites/sites.service.js';

export const SITE_KEY_HEADER = 'x-api-key';

/** Resolves the calling website from its API key (header `x-api-key`). */
@Injectable()
export class SiteKeyGuard implements CanActivate {
  constructor(private readonly sites: SitesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { site?: Site }>();
    const key = req.header(SITE_KEY_HEADER);
    if (!key)
      throw new UnauthorizedException(`Missing ${SITE_KEY_HEADER} header`);
    const site = await this.sites.findByApiKey(key);
    if (!site) throw new UnauthorizedException('Invalid or inactive site key');
    req.site = site;
    return true;
  }
}

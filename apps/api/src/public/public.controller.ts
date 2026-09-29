import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Site } from '../sites/site.entity.js';
import {
  LangQuery,
  PublicArticleDetail,
  PublicArticlePage,
  PublicArticlesQuery,
  PublicCategory,
  PublicSiteInfo,
} from './public.dto.js';
import { PublicService } from './public.service.js';
import { SITE_KEY_HEADER, SiteKeyGuard } from './site-key.guard.js';

type SiteRequest = Request & { site: Site };

/** Read-only content API consumed by the public websites. */
@ApiTags('public')
@ApiHeader({
  name: SITE_KEY_HEADER,
  required: true,
  description: 'Site API key (from the admin → Sites page)',
})
@ApiUnauthorizedResponse({ description: 'Missing or invalid site key' })
@Controller('public')
@UseGuards(SiteKeyGuard)
export class PublicController {
  constructor(private readonly svc: PublicService) {}

  @Get('site')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ type: PublicSiteInfo })
  site(
    @Req() req: SiteRequest,
    @Query() q: LangQuery,
  ): Promise<PublicSiteInfo> {
    return this.svc.siteInfo(req.site, this.svc.resolveLang(req.site, q.lang));
  }

  @Get('categories')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ type: [PublicCategory] })
  async categories(
    @Req() req: SiteRequest,
    @Query() q: LangQuery,
  ): Promise<PublicCategory[]> {
    const lang = this.svc.resolveLang(req.site, q.lang);
    return (await this.svc.siteCategories(req.site)).map((c) =>
      this.svc.presentCategory(c, lang),
    );
  }

  @Get('articles')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOkResponse({ type: PublicArticlePage })
  articles(
    @Req() req: SiteRequest,
    @Query() q: PublicArticlesQuery,
  ): Promise<PublicArticlePage> {
    return this.svc.list(req.site, q);
  }

  @Get('articles/:slug')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOkResponse({ type: PublicArticleDetail })
  article(
    @Req() req: SiteRequest,
    @Param('slug') slug: string,
    @Query() q: LangQuery,
  ): Promise<PublicArticleDetail> {
    return this.svc.detail(req.site, slug, q.lang);
  }
}

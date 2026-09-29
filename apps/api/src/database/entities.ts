import { Article, ArticleTranslation } from '../articles/article.entity.js';
import { Category } from '../categories/category.entity.js';
import { FeedItem } from '../feeds/feed-item.entity.js';
import { Feed } from '../feeds/feed.entity.js';
import { Settings } from '../settings/settings.entity.js';
import { Site } from '../sites/site.entity.js';
import { User } from '../users/user.entity.js';

export const ENTITIES = [
  User,
  Category,
  Feed,
  FeedItem,
  Article,
  ArticleTranslation,
  Site,
  Settings,
];

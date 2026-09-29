export interface CategoryOption {
  slug: string;
  name: string;
}

export interface RestructureInput {
  title: string;
  content: string;
  sourceName: string;
  sourceLanguage: string;
  publishedAt: Date;
  categoryHint: string | null;
  categories: CategoryOption[];
  targetLanguages: string[];
}

export interface TranslatedCopy {
  language: string;
  headline: string;
  summary: string;
  keyPoints: string[];
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
}

export interface RestructureResult {
  categorySlug: string | null;
  tags: string[];
  translations: TranslatedCopy[];
  engine: string;
}

export interface Restructurer {
  readonly name: string;
  restructure(input: RestructureInput): Promise<RestructureResult>;
}

/** Retrying later may succeed (rate limit, outage, timeout): stop the batch, keep items pending. */
export class TransientRestructureError extends Error {}

/** Misconfiguration (bad API key, no credits): stop the batch, don't burn item attempts. */
export class FatalRestructureError extends Error {}

export const MAX_KEY_POINTS = 4;
export const MAX_TAGS = 5;

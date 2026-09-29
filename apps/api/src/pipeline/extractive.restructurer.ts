import { splitSentences, truncate } from '../common/text.js';
import {
  MAX_KEY_POINTS,
  type RestructureInput,
  type RestructureResult,
  type Restructurer,
} from './restructurer.js';

/**
 * No-LLM fallback: cleans up and trims what the feed provided. It cannot translate,
 * so it only produces the source language.
 */
export class ExtractiveRestructurer implements Restructurer {
  readonly name = 'extractive';

  async restructure(input: RestructureInput): Promise<RestructureResult> {
    const sentences = splitSentences(input.content);
    const summary =
      truncate(sentences.slice(0, 2).join(' '), 400) || input.title;
    return {
      categorySlug: input.categoryHint,
      tags: [],
      engine: this.name,
      translations: [
        {
          language: input.sourceLanguage,
          headline: input.title,
          summary,
          keyPoints: sentences
            .slice(2, 2 + MAX_KEY_POINTS)
            .map((s) => truncate(s, 200)),
          seoTitle: truncate(input.title, 60),
          metaDescription: truncate(summary, 155),
          focusKeyword: '',
        },
      ],
    };
  }
}

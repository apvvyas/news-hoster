import { SarvamAIClient, SarvamAIError, SarvamAITimeoutError } from 'sarvamai';
import {
  FatalRestructureError,
  TransientRestructureError,
} from '../pipeline/restructurer.js';

/** The subset of the Sarvam client we use (makes it easy to fake in tests). */
export interface SarvamChatClient {
  chat: Pick<SarvamAIClient['chat'], 'completions'>;
}

export function createSarvamClient(
  apiKey: string,
  baseUrl?: string,
): SarvamChatClient {
  return new SarvamAIClient({
    apiSubscriptionKey: apiKey,
    baseUrl,
    timeoutInSeconds: 120,
    maxRetries: 2,
  });
}

/** Map SDK errors to: transient (retry later), fatal (misconfigured), or a plain per-request error. */
export function classifySarvamError(err: unknown): Error {
  if (err instanceof SarvamAITimeoutError)
    return new TransientRestructureError('Sarvam request timed out');
  if (err instanceof SarvamAIError) {
    const status = err.statusCode ?? 0;
    const msg = `Sarvam API error ${status}: ${err.message}`;
    if (status === 401 || status === 402 || status === 403)
      return new FatalRestructureError(msg);
    if (status === 429 || status >= 500 || status === 0)
      return new TransientRestructureError(msg);
    return new Error(msg);
  }
  return new TransientRestructureError(String(err));
}

/** Parse JSON, tolerating a ```json fence or stray text around the object. */
export function parseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start)
      return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('Sarvam response was not valid JSON');
  }
}

/** JSON-schema fragment for one language version, shared by the restructurer and the chat assistant. */
export const VERSION_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    key_points: { type: 'array', items: { type: 'string' } },
    seo_title: { type: 'string' },
    meta_description: { type: 'string' },
    focus_keyword: { type: 'string' },
  },
  required: [
    'headline',
    'summary',
    'key_points',
    'seo_title',
    'meta_description',
    'focus_keyword',
  ],
  additionalProperties: false,
} as const;

export interface SarvamVersion {
  headline: string;
  summary: string;
  key_points: string[];
  seo_title: string;
  meta_description: string;
  focus_keyword: string;
}

export const SEO_RULES = `- seo_title: 50-60 characters, contains the focus keyword, no clickbait.
- meta_description: 120-155 characters, a compelling factual summary containing the focus keyword.
- focus_keyword: the 1-4 word phrase readers would search for, in the version's language.`;

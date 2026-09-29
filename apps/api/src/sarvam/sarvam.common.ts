import {
  SarvamAIClient,
  SarvamAIError,
  SarvamAITimeoutError,
  type SarvamAI,
} from 'sarvamai';
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

export type SarvamReasoning = 'none' | 'low' | 'medium' | 'high';

export interface SarvamOptions {
  /**
   * Reasoning depth. sarvam-105b is a reasoning model and its hidden reasoning
   * counts against max_tokens; for rewriting it mostly adds cost and latency
   * (measured: ~7x the tokens, ~6x slower), so the default is 'none'.
   */
  reasoning: SarvamReasoning;
  /** Output ceiling per request, reasoning included. */
  maxTokens: number;
}

export const DEFAULT_SARVAM_OPTIONS: SarvamOptions = {
  reasoning: 'none',
  maxTokens: 8000,
};

/** Request fields for reasoning and output length. */
export function sarvamLimits(opts: SarvamOptions) {
  return {
    // Sarvam disables reasoning when reasoning_effort is explicitly null (the
    // SDK types don't model null, hence the cast); omitting it means 'medium'.
    reasoning_effort: (opts.reasoning === 'none'
      ? null
      : opts.reasoning) as unknown as 'low',
    max_tokens: opts.maxTokens,
  };
}

/** Longest run of consecutive whitespace we accept before treating the output as a runaway loop. */
const MAX_WHITESPACE_RUN = 200;

export class SarvamOutputError extends Error {}

export interface JsonCompletion {
  /** The JSON text (up to the end of the top-level object). */
  text: string;
  /** Model that served the request. */
  model: string;
}

type CompletionRequest = Omit<SarvamAI.ChatCompletionsRequest, 'stream'>;

/** The fields of a streamed chunk we use (the SDK doesn't export its chunk type). */
export interface StreamChunk {
  model?: string;
  choices?: {
    delta?: { content?: string | null; refusal?: string | null };
    finish_reason?: string | null;
  }[];
}

/**
 * Streams a JSON-schema completion and returns the JSON text.
 *
 * sarvam-105b occasionally gets stuck emitting whitespace in structured-output
 * mode (the schema allows unlimited whitespace between tokens) until it hits
 * max_tokens, which takes over a minute. Streaming lets us stop as soon as the
 * top-level object is complete, abort within ~1s when a whitespace loop starts,
 * and retry.
 */
export async function streamJsonCompletion(
  client: SarvamChatClient,
  request: CompletionRequest,
  attempts = 2,
): Promise<JsonCompletion> {
  let lastProblem = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    let stream: AsyncIterable<StreamChunk>;
    try {
      stream = await client.chat.completions(
        { ...request, stream: true },
        { abortSignal: controller.signal },
      );
    } catch (err) {
      throw classifySarvamError(err);
    }

    const scan = new JsonScanner();
    let model = String(request.model);
    let finish: string | null = null;
    let refusal = '';
    try {
      for await (const chunk of stream) {
        model = chunk.model || model;
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        if (choice.delta?.refusal) refusal += choice.delta.refusal;
        if (choice.delta?.content) scan.push(choice.delta.content);
        if (choice.finish_reason) finish = choice.finish_reason;
        if (scan.complete || scan.whitespaceRun > MAX_WHITESPACE_RUN) break;
      }
    } catch (err) {
      if (!controller.signal.aborted) throw classifySarvamError(err);
    } finally {
      controller.abort(); // stop generation (and billing) we no longer need
    }

    if (refusal || finish === 'content_filter')
      throw new Error(`Sarvam declined: ${refusal || 'content_filter'}`);
    if (scan.complete) return { text: scan.text, model };
    lastProblem =
      scan.whitespaceRun > MAX_WHITESPACE_RUN
        ? 'runaway whitespace'
        : finish === 'length'
          ? 'output hit max_tokens'
          : 'incomplete JSON';
  }
  throw new SarvamOutputError(
    `Sarvam returned unusable output (${lastProblem}) after ${attempts} attempts`,
  );
}

/** Incremental scanner: knows when the top-level JSON object closes and how much whitespace trails. */
export class JsonScanner {
  text = '';
  complete = false;
  whitespaceRun = 0;
  private depth = 0;
  private started = false;
  private inString = false;
  private escaped = false;

  push(chunk: string): void {
    for (const ch of chunk) {
      if (this.complete) return;
      this.text += ch;
      this.whitespaceRun = /\s/.test(ch) ? this.whitespaceRun + 1 : 0;
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === '\\') this.escaped = true;
        else if (ch === '"') this.inString = false;
      } else if (ch === '"') this.inString = true;
      else if (ch === '{' || ch === '[') {
        this.depth++;
        this.started = true;
      } else if (ch === '}' || ch === ']') {
        this.depth--;
        if (this.started && this.depth === 0) this.complete = true;
      }
    }
  }
}

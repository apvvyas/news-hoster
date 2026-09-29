import { SarvamAIError } from 'sarvamai';
import {
  FatalRestructureError,
  TransientRestructureError,
  type RestructureInput,
} from './restructurer.js';
import {
  parseJson,
  SarvamRestructurer,
  type SarvamChatClient,
} from './sarvam.restructurer.js';

const input: RestructureInput = {
  title: 'Local team wins championship',
  content: 'The Rivertown Otters won the regional title 3-1.',
  sourceName: 'Sample Wire',
  sourceLanguage: 'en',
  publishedAt: new Date('2026-09-27T18:30:00Z'),
  categoryHint: 'other',
  categories: [
    { slug: 'sports', name: 'Sports' },
    { slug: 'other', name: 'Other' },
  ],
  targetLanguages: ['en', 'hi'],
};

/** Streams `content` in small chunks, like the real API does. */
async function* streamOf(content: string, finish_reason = 'stop') {
  for (let i = 0; i < content.length; i += 7) {
    yield {
      model: 'sarvam-105b',
      choices: [
        { delta: { content: content.slice(i, i + 7) }, finish_reason: null },
      ],
    };
  }
  yield { model: 'sarvam-105b', choices: [{ delta: {}, finish_reason }] };
}

function clientReturning(content: string, finish_reason = 'stop') {
  const calls: unknown[] = [];
  const client = {
    chat: {
      completions: async (req: unknown) => {
        calls.push(req);
        return streamOf(content, finish_reason);
      },
    },
  } as unknown as SarvamChatClient;
  return { client, calls };
}

const good = {
  category: 'sports',
  tags: ['Rivertown Otters', 'football', 'football'],
  versions: {
    en: {
      headline: 'Otters take regional title',
      summary: 'The Otters won 3-1.',
      key_points: ['Score: 3-1', ' '],
    },
    hi: {
      headline: 'ओटर्स ने क्षेत्रीय खिताब जीता',
      summary: 'ओटर्स ने 3-1 से जीत दर्ज की।',
      key_points: [],
    },
  },
};

describe('SarvamRestructurer', () => {
  it('sends a strict JSON schema with one version per target language', async () => {
    const { client, calls } = clientReturning(JSON.stringify(good));
    const result = await new SarvamRestructurer(
      client,
      'sarvam-105b',
    ).restructure(input);

    const req = calls[0] as any;
    expect(req.model).toBe('sarvam-105b');
    expect(req.stream).toBe(true);
    // Reasoning is explicitly disabled (null, not omitted) so it can't eat the token budget.
    expect(req).toHaveProperty('reasoning_effort', null);
    expect(req.max_tokens).toBe(8000);
    expect(req.response_format.type).toBe('json_schema');
    expect(req.response_format.json_schema.strict).toBe(true);
    expect(
      req.response_format.json_schema.schema.properties.versions.required,
    ).toEqual(['en', 'hi']);
    expect(
      req.response_format.json_schema.schema.properties.category.enum,
    ).toEqual(['sports', 'other']);
    expect(req.messages[1].content).toContain(
      '<title>Local team wins championship</title>',
    );

    expect(result.engine).toBe('sarvam:sarvam-105b');
    expect(result.categorySlug).toBe('sports');
    expect(result.tags).toEqual(['rivertown otters', 'football']);
    expect(result.translations.map((t) => t.language)).toEqual(['en', 'hi']);
    expect(result.translations[0].keyPoints).toEqual(['Score: 3-1']);
    expect(result.translations[1].headline).toBe(
      'ओटर्स ने क्षेत्रीय खिताब जीता',
    );
  });

  it('passes a configured reasoning level through', async () => {
    const { client, calls } = clientReturning(JSON.stringify(good));
    await new SarvamRestructurer(client, 'm', {
      reasoning: 'low',
      maxTokens: 12000,
    }).restructure(input);
    expect(calls[0]).toMatchObject({
      reasoning_effort: 'low',
      max_tokens: 12000,
    });
  });

  it('falls back to the category hint for unknown categories', async () => {
    const { client } = clientReturning(
      JSON.stringify({ ...good, category: 'nope' }),
    );
    expect(
      (await new SarvamRestructurer(client, 'm').restructure(input))
        .categorySlug,
    ).toBe('other');
  });

  it('rejects truncated output and missing languages', async () => {
    await expect(
      new SarvamRestructurer(
        clientReturning('{"category": "spo', 'length').client,
        'm',
      ).restructure(input),
    ).rejects.toThrow(/unusable output \(output hit max_tokens\)/);
    const missingHi = { ...good, versions: { en: good.versions.en } };
    await expect(
      new SarvamRestructurer(
        clientReturning(JSON.stringify(missingHi)).client,
        'm',
      ).restructure(input),
    ).rejects.toThrow(/"hi"/);
  });

  it('classifies API errors', async () => {
    const failing = (statusCode: number) =>
      ({
        chat: {
          completions: async () =>
            Promise.reject(new SarvamAIError({ message: 'x', statusCode })),
        },
      }) as unknown as SarvamChatClient;
    await expect(
      new SarvamRestructurer(failing(429), 'm').restructure(input),
    ).rejects.toBeInstanceOf(TransientRestructureError);
    await expect(
      new SarvamRestructurer(failing(503), 'm').restructure(input),
    ).rejects.toBeInstanceOf(TransientRestructureError);
    await expect(
      new SarvamRestructurer(failing(403), 'm').restructure(input),
    ).rejects.toBeInstanceOf(FatalRestructureError);
    const bad = new SarvamRestructurer(failing(400), 'm').restructure(input);
    await expect(bad).rejects.not.toBeInstanceOf(TransientRestructureError);
    await expect(bad).rejects.toThrow(/400/);
  });

  it('parses fenced JSON', () => {
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => parseJson('nope')).toThrow();
  });
});

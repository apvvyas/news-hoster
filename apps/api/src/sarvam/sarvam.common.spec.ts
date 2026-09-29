import {
  JsonScanner,
  streamJsonCompletion,
  type SarvamChatClient,
  type StreamChunk,
} from './sarvam.common.js';

const chunk = (
  content: string,
  finish_reason: string | null = null,
): StreamChunk => ({
  model: 'sarvam-105b',
  choices: [{ delta: { content }, finish_reason }],
});

/** A fake client whose Nth call streams scripts[N]; records whether each stream was aborted. */
function scriptedClient(scripts: StreamChunk[][]) {
  const aborted: boolean[] = [];
  const client = {
    chat: {
      completions: async (
        _req: unknown,
        opts: { abortSignal: AbortSignal },
      ) => {
        const n = aborted.push(false) - 1;
        opts.abortSignal.addEventListener('abort', () => (aborted[n] = true));
        const script = scripts[n];
        return (async function* () {
          for (const c of script) yield c;
        })();
      },
    },
  } as unknown as SarvamChatClient;
  return { client, aborted };
}

const request = {
  model: 'sarvam-105b' as const,
  messages: [{ role: 'user' as const, content: 'hi' }],
};

describe('JsonScanner', () => {
  it('knows when the top-level object closes, ignoring braces inside strings', () => {
    const s = new JsonScanner();
    s.push('{"a": "x } ] { \\" y", "b": [1, {"c": 2}]');
    expect(s.complete).toBe(false);
    s.push('}   trailing junk');
    expect(s.complete).toBe(true);
    expect(JSON.parse(s.text)).toEqual({ a: 'x } ] { " y', b: [1, { c: 2 }] });
  });

  it('counts the current run of whitespace', () => {
    const s = new JsonScanner();
    s.push('{"a": 1,' + ' \n'.repeat(10));
    expect(s.whitespaceRun).toBe(20);
    s.push('"b"');
    expect(s.whitespaceRun).toBe(0);
  });
});

describe('streamJsonCompletion', () => {
  it('returns as soon as the JSON is complete and stops the stream', async () => {
    const { client, aborted } = scriptedClient([
      [chunk('{"ok":'), chunk(' true}'), chunk('\n'.repeat(5000))],
    ]);
    const out = await streamJsonCompletion(client, request);
    expect(out).toEqual({ text: '{"ok": true}', model: 'sarvam-105b' });
    expect(aborted).toEqual([true]);
  });

  it('aborts a whitespace loop and retries', async () => {
    const loop = [
      chunk('{"reply": "done",'),
      ...Array.from({ length: 100 }, () => chunk('  \n  ')),
    ];
    const { client, aborted } = scriptedClient([
      loop,
      [chunk('{"reply": "done"}')],
    ]);
    const out = await streamJsonCompletion(client, request);
    expect(JSON.parse(out.text)).toEqual({ reply: 'done' });
    expect(aborted).toEqual([true, true]);
  });

  it('gives up with a clear error after repeated bad output', async () => {
    const truncated = [chunk('{"reply": "unfini'), chunk('', 'length')];
    const { client } = scriptedClient([truncated, truncated]);
    await expect(streamJsonCompletion(client, request)).rejects.toThrow(
      'Sarvam returned unusable output (output hit max_tokens) after 2 attempts',
    );
  });

  it('surfaces a refusal', async () => {
    const { client } = scriptedClient([
      [
        {
          model: 'm',
          choices: [
            { delta: { refusal: 'not allowed' }, finish_reason: 'stop' },
          ],
        },
      ],
    ]);
    await expect(streamJsonCompletion(client, request)).rejects.toThrow(
      'Sarvam declined: not allowed',
    );
  });
});

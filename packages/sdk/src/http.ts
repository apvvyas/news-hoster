export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type Query = Record<
  string,
  string | number | boolean | undefined | null
>;

export interface HttpOptions {
  /** API origin, e.g. "https://api.example.com". Use "" for same-origin. */
  baseUrl: string;
  headers?: () => Record<string, string>;
  fetch?: typeof fetch;
  onUnauthorized?: () => void;
}

export function toQueryString(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function createHttp(opts: HttpOptions) {
  const base = opts.baseUrl.replace(/\/+$/, '');
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);

  return async function request<T>(
    method: string,
    path: string,
    init: { query?: Query; body?: unknown } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...opts.headers?.(),
    };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    const res = await doFetch(
      `${base}/api${path}${toQueryString(init.query)}`,
      {
        method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      },
    );
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const data: unknown = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      if (res.status === 401) opts.onUnauthorized?.();
      const msg = (data as { message?: string | string[] } | undefined)
        ?.message;
      throw new ApiError(
        res.status,
        Array.isArray(msg) ? msg.join('; ') : msg || res.statusText,
        data,
      );
    }
    return data as T;
  };
}

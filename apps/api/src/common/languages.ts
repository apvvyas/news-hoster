/** Languages the platform can ingest and publish in. Add more (e.g. 'mr', 'ta') here. */
export const LANGUAGES = ['en', 'hi'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
};

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === 'string' &&
    (LANGUAGES as readonly string[]).includes(value)
  );
}

const DEVANAGARI = /[ऀ-ॿ]/g;
const LATIN = /[A-Za-z]/g;

/**
 * Cheap script-based language detection. Good enough to tell Hindi (Devanagari)
 * from English; feeds can also pin their language explicitly.
 */
export function detectLanguage(text: string): Language {
  const deva = text.match(DEVANAGARI)?.length ?? 0;
  const latin = text.match(LATIN)?.length ?? 0;
  return deva > 0 && deva >= latin * 0.3 ? 'hi' : 'en';
}

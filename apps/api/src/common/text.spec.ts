import { detectLanguage } from './languages.js';
import {
  canonicalUrl,
  slugify,
  splitSentences,
  stripHtml,
  titleKey,
  truncate,
} from './text.js';

describe('text helpers', () => {
  it('strips html and scripts', () => {
    expect(
      stripHtml('<p>Hi&nbsp;<b>there</b></p><script>x()</script><p>again</p>'),
    ).toBe('Hi there again');
  });

  it('canonicalises urls', () => {
    expect(canonicalUrl('HTTPS://Ex.com/a/?utm_source=x&id=1#frag')).toBe(
      'https://ex.com/a?id=1',
    );
  });

  it('builds unicode-aware title keys', () => {
    expect(titleKey('Local Team Wins Championship!')).toBe(
      titleKey('local team wins championship'),
    );
    expect(titleKey('दिल्ली में बारिश!')).toBe('दिल्ली में बारिश');
  });

  it('slugifies to ascii and returns empty for pure Hindi', () => {
    expect(slugify('Hello, World! Ünïcode')).toBe('hello-world-unicode');
    expect(slugify('दिल्ली में बारिश')).toBe('');
  });

  it('splits English and Hindi sentences', () => {
    expect(splitSentences('One. Two! Three?')).toEqual([
      'One.',
      'Two!',
      'Three?',
    ]);
    expect(splitSentences('पहला वाक्य। दूसरा वाक्य।')).toEqual([
      'पहला वाक्य।',
      'दूसरा वाक्य।',
    ]);
  });

  it('truncates on a word boundary', () => {
    expect(truncate('alpha beta gamma delta', 12)).toBe('alpha beta…');
  });
});

describe('detectLanguage', () => {
  it('detects Hindi and English', () => {
    expect(detectLanguage('दिल्ली में भारी बारिश')).toBe('hi');
    expect(detectLanguage('Heavy rain in Delhi')).toBe('en');
    expect(detectLanguage('ISRO ने Chandrayaan मिशन लॉन्च किया')).toBe('hi');
  });
});

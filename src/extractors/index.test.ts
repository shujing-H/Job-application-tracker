import { describe, expect, it } from 'vitest';
import { parseLinkedInSemanticHeader } from './index';

describe('LinkedIn semantic extractor fallback', () => {
  it('reads the current LinkedIn title and trims activity text from the location', () => {
    expect(parseLinkedInSemanticHeader([
      'Man Group',
      'Systematic Graduate Rotational Quant',
      'Boston, MA · 1 day ago · Over 100 people clicked apply',
    ], 'Man Group')).toEqual({
      role: 'Systematic Graduate Rotational Quant',
      location: 'Boston, MA',
    });
  });

  it('fails closed when the company header cannot be correlated', () => {
    expect(parseLinkedInSemanticHeader(['Unrelated text', 'Another paragraph'], 'Man Group'))
      .toEqual({ role: '', location: '' });
  });
});

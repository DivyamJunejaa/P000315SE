import { formatAUDFromCents } from '../lib/utils';

describe('utils.formatAUDFromCents', () => {
  test('formats positive cents to AUD string', () => {
    expect(formatAUDFromCents(123456)).toBe('$1,234.56');
  });

  test('formats zero cents', () => {
    expect(formatAUDFromCents(0)).toBe('$0.00');
  });

  test('returns em dash for null or undefined', () => {
    expect(formatAUDFromCents(null)).toBe('—');
    expect(formatAUDFromCents(undefined)).toBe('—');
  });
});
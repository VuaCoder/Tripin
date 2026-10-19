import { describe, expect, it } from 'vitest';
import { openCheckout } from '../utils/checkout';

describe('checkout URL validation', () => {
  it.each([
    '',
    'not a URL',
    'javascript:alert(1)',
    'http://untrusted.test/pay',
  ])('rejects an unusable checkout URL: %s', (url) => {
    expect(() => openCheckout(url)).toThrow('Liên kết thanh toán không hợp lệ');
  });
});

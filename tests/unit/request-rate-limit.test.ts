import { describe, expect, it } from 'vitest';
import { requestSubjectHash } from '@/lib/request-rate-limit';

describe('request rate-limit subject', () => {
  it('uses the first forwarded address and never returns raw network data', () => {
    const value = requestSubjectHash(new Headers({ 'x-forwarded-for': '203.0.113.8, 10.0.0.2' }));
    expect(value).toMatch(/^[a-f0-9]{64}$/);
    expect(value).not.toContain('203.0.113.8');
  });
});

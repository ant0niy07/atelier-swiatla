import { createHash } from 'node:crypto';

export function requestSubjectHash(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const subject = forwarded || headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(subject).digest('hex');
}

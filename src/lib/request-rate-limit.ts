import { createHash } from 'node:crypto';

export function requestSubjectHash(headers: Headers) {
  // Vercel adds x-vercel-forwarded-for at its trusted edge. Prefer it over the
  // generic forwarding header, which is only a fallback for local adapters.
  const vercelForwarded = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const subject = vercelForwarded || forwarded || headers.get('x-real-ip') || crypto.randomUUID();
  return createHash('sha256').update(subject).digest('hex');
}

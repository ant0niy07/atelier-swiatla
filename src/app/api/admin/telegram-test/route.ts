import { NextResponse } from 'next/server';
import { requireAdminService } from '@/lib/admin-auth';
import { sendTelegram } from '@/lib/telegram';

export async function POST() {
  try { await requireAdminService(); } catch { return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); }
  const result = await sendTelegram('🕯 ATELIER ŚWIEC\n\n✅ Powiadomienie testowe z panelu administracyjnego.');
  return result.sent ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.reason ?? 'SEND_FAILED' }, { status: 503 });
}

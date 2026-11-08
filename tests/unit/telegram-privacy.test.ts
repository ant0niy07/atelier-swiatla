import { describe, expect, it, vi } from 'vitest';

describe('Telegram order notification privacy', () => {
  it('does not include unstructured customer notes in the Telegram payload', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token');
    vi.stubEnv('TELEGRAM_CHAT_ID', 'chat');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { notifyTelegramOrder } = await import('@/lib/telegram');
    await notifyTelegramOrder({ order_number: 42, total_grosz: 6341, order_items: [{ product_name: 'Winter Amber', quantity: 1 }] });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.text).toContain('Winter Amber');
    expect(sent.text).not.toContain('123 456 789');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});

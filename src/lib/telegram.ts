type TelegramOrder = { order_number: number; total_grosz: number; customer_note: string | null; order_items: Array<{ product_name: string; quantity: number }> };

function message(order: TelegramOrder) {
  const lines = order.order_items.map((item) => `• ${item.product_name} — ${item.quantity} szt.`).join('\n');
  const note = order.customer_note?.trim() ? `\n\n📝 Uwagi do zamówienia:\n${order.customer_note.trim().slice(0, 1000)}` : '';
  return `🕯 ATELIER ŚWIEC\n\n🛒 Nowe zamówienie nr ${order.order_number}\n\n📦 Produkty:\n${lines}\n\n💰 Suma: ${(order.total_grosz / 100).toFixed(2)} zł${note}`;
}

export async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { sent: false, reason: 'not_configured' as const };
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }) });
    return { sent: response.ok };
  } catch { return { sent: false, reason: 'network' as const }; }
}

export async function notifyTelegramOrder(order: TelegramOrder) { return sendTelegram(message(order)); }

type TelegramOrder = { order_number: number; total_grosz: number; order_items: Array<{ product_name: string; quantity: number }> };

function message(order: TelegramOrder) {
  const lines = order.order_items.map((item) => `• ${item.product_name} — ${item.quantity} szt.`).join('\n');
  // Customer notes are unstructured and can contain a phone number, address,
  // or other personal data. They remain in the protected admin panel only.
  return `🕯 ATELIER ŚWIEC\n\n🛒 Nowe zamówienie nr ${order.order_number}\n\n📦 Produkty:\n${lines}\n\n💰 Suma: ${(order.total_grosz / 100).toFixed(2)} zł`;
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

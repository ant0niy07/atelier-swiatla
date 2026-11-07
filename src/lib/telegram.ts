export async function notifyTelegramOrder(order: { orderNumber: number; totalGrosz: number; email: string }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { sent: false, reason: 'not_configured' as const };
  const text = `ATELIER ŚWIEC — nowe zamówienie #${order.orderNumber}\n${(order.totalGrosz / 100).toFixed(2)} zł\n${order.email}`;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }) });
    return { sent: response.ok };
  } catch { return { sent: false, reason: 'network' as const }; }
}

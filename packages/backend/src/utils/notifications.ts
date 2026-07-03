import { sendTelegramMessage } from "./telegram";

export async function notifyNewOrder(chatId: string | null, customerName: string, totalAmount: number): Promise<void> {
  if (!chatId) return;
  await sendTelegramMessage(chatId, `Новый заказ от ${customerName} на сумму ${totalAmount.toLocaleString("ru-RU")} сум`);
}

export async function notifyLowStock(chatId: string | null, sku: string, stockQuantity: number): Promise<void> {
  if (!chatId) return;
  await sendTelegramMessage(chatId, `Низкий остаток: ${sku} — осталось ${stockQuantity} шт.`);
}

export async function notifyNewChatMessage(chatId: string | null, customerName: string, text: string): Promise<void> {
  if (!chatId) return;
  await sendTelegramMessage(chatId, `Новое сообщение от ${customerName}: "${text}"`);
}

export async function notifyPaymentExpiringSoon(chatId: string | null, amount: number, dueDate: Date): Promise<void> {
  if (!chatId) return;
  const dateStr = dueDate.toLocaleDateString("ru-RU");
  await sendTelegramMessage(chatId, `Напоминание: счёт на ${amount.toLocaleString("ru-RU")} сум нужно оплатить до ${dateStr}, иначе магазин будет заблокирован.`);
}

import { sendTelegramMessage } from "./telegram";

export async function notifyNewOrder(chatId: string | null, customerName: string, totalAmount: number): Promise<void> {
  if (!chatId) return;
  await sendTelegramMessage(chatId, `Новый заказ от ${customerName} на сумму ${totalAmount.toLocaleString("ru-RU")} сум`);
}

export async function notifyLowStock(chatId: string | null, sku: string, stockQuantity: number): Promise<void> {
  if (!chatId) return;
  await sendTelegramMessage(chatId, `Низкий остаток: ${sku} — осталось ${stockQuantity} шт.`);
}

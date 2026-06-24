export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  console.log(`[telegram] To ${chatId}: ${text}`);
}

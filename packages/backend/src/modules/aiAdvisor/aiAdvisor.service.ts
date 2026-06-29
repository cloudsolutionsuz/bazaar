import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import { getAnalytics, getBalance, getPnL } from "../finance/finance.service";
import { listLowStock } from "../inventory/inventory.service";
import { listSuppliers } from "../suppliers/suppliers.service";
import type { AskInput } from "./aiAdvisor.schema";

const LOW_STOCK_LIMIT = 10;

// A compact text block, not a JSON dump - cheaper in tokens and easier for
// the model to read than a literal data structure, same spirit as how the
// rest of this project favors plain numbers over abstraction.
async function buildBusinessSnapshot(tenantId: string): Promise<string> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [analytics, pnl, lowStock, kassaBalance, suppliers] = await Promise.all([
    getAnalytics(tenantId, thirtyDaysAgo, now),
    getPnL(tenantId, thirtyDaysAgo, now),
    listLowStock(tenantId),
    getBalance(tenantId),
    listSuppliers(tenantId, { pageSize: 100 }),
  ]);

  const totalSupplierDebt = suppliers.items.reduce((sum, s) => sum + s.balance, 0);

  const topProductsText = analytics.topProducts
    .map((p, i) => `${i + 1}. ${p.productName} - выручка ${p.revenue.toLocaleString()}, продано ${p.quantity} шт.`)
    .join("\n");

  const marginText = pnl.byProduct
    .slice(0, 5)
    .map((p) => `- ${p.productName}: выручка ${p.revenue.toLocaleString()}, себестоимость ${p.cogs.toLocaleString()}, маржа ${p.margin}%`)
    .join("\n");

  const lowStockText = lowStock
    .slice(0, LOW_STOCK_LIMIT)
    .map((v) => `- ${v.product.name} (${v.sku}): осталось ${v.stockQuantity} шт.`)
    .join("\n");

  return `Данные магазина за последние 30 дней (на ${now.toISOString().slice(0, 10)}):

Выручка: ${analytics.revenue.toLocaleString()}
Количество заказов: ${analytics.orderCount}
Средний чек: ${analytics.averageOrderValue.toLocaleString()}

P&L за этот же период:
Выручка: ${pnl.revenue.toLocaleString()}
Себестоимость: ${pnl.cogs.toLocaleString()}
Расходы: ${pnl.expenses.toLocaleString()}
Чистая прибыль: ${pnl.netProfit.toLocaleString()}

Топ товаров по выручке:
${topProductsText || "(нет продаж за период)"}

Маржинальность по товарам:
${marginText || "(нет данных)"}

Товары с низким остатком:
${lowStockText || "(нет товаров с низким остатком)"}

Текущий баланс кассы: ${kassaBalance.toLocaleString()}
Общий долг поставщикам: ${totalSupplierDebt.toLocaleString()}`;
}

const SYSTEM_PREAMBLE = `Ты бизнес-консультант для владельца небольшого магазина в Узбекистане, использующего платформу Bazaar.
Отвечай только на основе данных, которые тебе предоставлены ниже - если вопрос касается того, чего в данных нет, честно скажи об этом, не выдумывай цифры.
Отвечай кратко и по делу, на том же языке, на котором задан вопрос (по умолчанию на русском).`;

export async function ask(tenantId: string, input: AskInput): Promise<string> {
  if (!env.anthropicApiKey) {
    throw new AppError(503, "AI_NOT_CONFIGURED", "AI advisor is not configured on this platform yet");
  }

  const snapshot = await buildBusinessSnapshot(tenantId);
  const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

  const response = await anthropic.messages.create({
    model: env.anthropicModel,
    max_tokens: 1024,
    system: `${SYSTEM_PREAMBLE}\n\n${snapshot}`,
    messages: [...(input.history ?? []), { role: "user", content: input.question }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}

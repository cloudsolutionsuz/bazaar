import { getAnalytics, getBalance } from "../finance/finance.service";
import { listLowStock } from "../inventory/inventory.service";
import { listOrders } from "../orders/orders.service";
import { getUnreadCount } from "../chat/chat.service";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(): Date {
  const d = startOfToday();
  const dayOfWeek = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

export async function getSummary(tenantId: string) {
  const now = new Date();
  const todayStart = startOfToday();
  const weekStart = startOfWeek();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [todayAnalytics, weekAnalytics, monthAnalytics, lowStock, recentOrders, kassaBalance, unreadChatCount] = await Promise.all([
    getAnalytics(tenantId, todayStart, now),
    getAnalytics(tenantId, weekStart, now),
    getAnalytics(tenantId, thirtyDaysAgo, now, "day"),
    listLowStock(tenantId),
    listOrders(tenantId, { page: 1, pageSize: 5 }),
    getBalance(tenantId),
    getUnreadCount(tenantId),
  ]);

  return {
    today: { revenue: todayAnalytics.revenue, orderCount: todayAnalytics.orderCount },
    week: { revenue: weekAnalytics.revenue, orderCount: weekAnalytics.orderCount },
    lowStockCount: lowStock.length,
    recentOrders: recentOrders.items,
    salesOverTime: monthAnalytics.salesOverTime,
    topProducts: monthAnalytics.topProducts,
    kassaBalance,
    unreadChatCount,
  };
}

import { getAnalytics } from "../finance/finance.service";
import { listLowStock } from "../inventory/inventory.service";
import { listOrders } from "../orders/orders.service";

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

  const [todayAnalytics, weekAnalytics, lowStock, recentOrders] = await Promise.all([
    getAnalytics(tenantId, todayStart, now),
    getAnalytics(tenantId, weekStart, now),
    listLowStock(tenantId),
    listOrders(tenantId, { page: 1, pageSize: 5 }),
  ]);

  return {
    today: { revenue: todayAnalytics.revenue, orderCount: todayAnalytics.orderCount },
    week: { revenue: weekAnalytics.revenue, orderCount: weekAnalytics.orderCount },
    lowStockCount: lowStock.length,
    recentOrders: recentOrders.items,
  };
}

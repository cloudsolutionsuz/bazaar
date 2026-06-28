export type ProductStatus = "ACTIVE" | "HIDDEN" | "OUT_OF_STOCK";
export type InventoryMovementType = "RECEIPT" | "SALE" | "RETURN" | "ADJUSTMENT" | "WRITE_OFF" | "STOCKTAKE" | "SUPPLIER_RETURN";
export type OrderStatus = "NEW" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED" | "ARCHIVED";

export type TenantStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "BLOCKED";

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  status: TenantStatus;
  planId: string;
  trialEndsAt: string | null;
  telegramChatId: string | null;
  logoUrl: string | null;
  themeColor: string | null;
  description: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string | null;
  email: string;
  role: "SUPER_ADMIN" | "OWNER" | "MANAGER" | "CASHIER";
  name: string;
  phone: string | null;
  emailVerifiedAt: string | null;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  tenantId: string;
  productId: string;
  name: string | null;
  sku: string;
  priceOverride: number | null;
  stockQuantity: number;
  lowStockThreshold: number | null;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  position: number;
}

export interface Product {
  id: string;
  tenantId: string;
  categoryId: string | null;
  category: Category | null;
  name: string;
  description: string | null;
  price: number;
  brand: string | null;
  color: string | null;
  code: string | null;
  currency: string;
  status: ProductStatus;
  variants: ProductVariant[];
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  createdAt: string;
}

// listSuppliers replays receipts/returns/payments to attach a current debt
// figure - create/update don't compute this, so it's a separate type rather
// than a field on the base Supplier.
export interface SupplierWithBalance extends Supplier {
  balance: number;
}

export interface SupplierStatementEntry {
  date: string;
  type: "RECEIPT" | "SUPPLIER_RETURN" | "PAYMENT";
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
}

export interface SupplierStatement {
  supplier: Supplier;
  openingBalance: number;
  entries: SupplierStatementEntry[];
  closingBalance: number;
}

export interface InventoryMovement {
  id: string;
  tenantId: string;
  variantId: string;
  variant?: ProductVariant & { product: Product };
  type: InventoryMovementType;
  quantity: number;
  purchasePrice: number | null;
  note: string | null;
  orderId: string | null;
  supplierId: string | null;
  supplier?: Supplier | null;
  createdByUserId: string;
  createdAt: string;
}

export interface DailyReportRow {
  variantId: string;
  productName: string;
  sku: string;
  openingStock: number;
  receipts: number;
  sales: number;
  writeOffs: number;
  supplierReturns: number;
  stocktakeAdjustments: number;
  closingStock: number;
  actualStock: number | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  variant: ProductVariant & { product: Product };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedByUserId: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  tenantId: string;
  customerName: string;
  customerPhone: string;
  additionalPhones: string[];
  addressRegion: string | null;
  addressDistrict: string | null;
  addressMahalla: string | null;
  addressNote: string | null;
  status: OrderStatus;
  courierName: string | null;
  paymentMethod: string | null;
  totalAmount: number;
  items: OrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
}

export interface CustomerDetail {
  id: string;
  phone: string;
  name: string;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
  orders: Order[];
}

export interface DashboardSummary {
  today: { revenue: number; orderCount: number };
  week: { revenue: number; orderCount: number };
  lowStockCount: number;
  recentOrders: Order[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export type InvoiceStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

export interface Plan {
  id: string;
  code: string;
  name: string;
  priceSum: number;
  maxProducts: number | null;
  maxOrdersPerMonth: number | null;
  maxEmployees: number | null;
}

export interface BillingInvoice {
  id: string;
  tenantId: string;
  planId: string;
  planCode: string;
  amount: number;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt: string | null;
  provider: "PAYME" | "CLICK" | "MANUAL" | null;
}

export interface BillingSummary {
  tenant: Tenant & { plan: Plan };
  invoices: BillingInvoice[];
  nextInvoice: BillingInvoice | null;
}

export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionStatus = "PENDING" | "CONFIRMED";

export interface CashRegister {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface FinanceTransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  category: string;
  amount: number;
  description: string | null;
  orderId: string | null;
  cashRegisterId: string | null;
  supplierId: string | null;
  createdAt: string;
}

export interface PendingTransaction extends FinanceTransaction {
  order: Order | null;
}

export interface DailySummary {
  openingBalance: number;
  income: number;
  expense: number;
  closingBalance: number;
  pendingIncome: number;
}

export interface ProductBreakdown {
  productId: string;
  productName: string;
  revenue: number;
  cogs: number;
  margin: number;
}

export interface PnLResult {
  revenue: number;
  cogs: number;
  expenses: number;
  netProfit: number;
  byProduct: ProductBreakdown[];
}

export interface SalesBucket {
  bucket: string;
  revenue: number;
  orderCount: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  revenue: number;
  quantity: number;
}

export interface AnalyticsResult {
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  visits: number;
  conversionRate: number;
  salesOverTime: SalesBucket[];
  topProducts: TopProduct[];
}

export interface SalesForecastPoint {
  date: string;
  revenue: number;
}

export interface SalesForecastResult {
  history: SalesForecastPoint[];
  forecast: SalesForecastPoint[];
  totalForecastRevenue: number;
  dailyAverageForecast: number;
  slopePerDay: number;
}

export interface TenantWithRelations extends Tenant {
  plan: Plan;
  users: User[];
  invoices: BillingInvoice[];
}

export interface Banner {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  position: number;
  isActive: boolean;
}

export interface PlatformStats {
  totalTenants: number;
  byStatus: Record<TenantStatus, number>;
  mrr: number;
}

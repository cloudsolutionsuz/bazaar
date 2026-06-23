export type ProductStatus = "ACTIVE" | "HIDDEN" | "OUT_OF_STOCK";
export type InventoryMovementType = "RECEIPT" | "SALE" | "RETURN" | "ADJUSTMENT";
export type OrderStatus = "NEW" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "BLOCKED";
  planId: string;
  trialEndsAt: string | null;
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
  status: ProductStatus;
  variants: ProductVariant[];
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
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
  createdByUserId: string;
  createdAt: string;
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
  customerAddress: string | null;
  status: OrderStatus;
  paymentMethod: string | null;
  totalAmount: number;
  items: OrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
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

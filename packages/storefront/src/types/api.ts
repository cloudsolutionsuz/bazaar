export type ProductStatus = "ACTIVE" | "HIDDEN" | "OUT_OF_STOCK";

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string | null;
  sku: string;
  priceOverride: number | null;
  stockQuantity: number;
}

export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface Product {
  id: string;
  categoryId: string | null;
  category: Category | null;
  name: string;
  description: string | null;
  price: number;
  status: ProductStatus;
  variants: ProductVariant[];
  images: ProductImage[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderItemResult {
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderResult {
  id: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  status: string;
  items: OrderItemResult[];
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

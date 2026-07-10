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
  descriptionRu: string | null;
  descriptionUz: string | null;
  price: number;
  discountPercent: number | null;
  brand: string | null;
  color: string | null;
  currency: string;
  status: ProductStatus;
  position: number;
  variants: ProductVariant[];
  images: ProductImage[];
  promotionName: string | null;
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
  variant?: { product: { name: string } };
}

export interface OrderResult {
  id: string;
  customerName: string;
  customerPhone: string;
  additionalPhones: string[];
  addressRegion: string | null;
  addressDistrict: string | null;
  addressMahalla: string | null;
  addressNote: string | null;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: OrderItemResult[];
}

export interface Banner {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  position: number;
}

export interface TenantMeta {
  name: string;
  logoUrl: string | null;
  themeColor: string | null;
  description: string | null;
  inn: string | null;
  companyName: string | null;
  contactPhone: string | null;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  minOrderAmount: number;
  paymentMethods: string[];
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface ChatMessage {
  id: string;
  sender: "CUSTOMER" | "STAFF";
  text: string;
  createdAt: string;
}

export interface ProductReview {
  id: string;
  customerName: string;
  rating: number;
  text: string | null;
  createdAt: string;
}

export interface ProductReviewsResult {
  reviews: ProductReview[];
  averageRating: number | null;
  reviewCount: number;
}

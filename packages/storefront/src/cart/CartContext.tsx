import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SaleUnit } from "../types/api";

// A line is one variant bought in one unit: the same variant can sit in the
// cart twice, once by the piece and once by the box. Prices and maxStock are
// always per piece; `quantity` counts whole units of `unit`.
export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  unitPrice: number;
  originalPrice: number;
  unit: SaleUnit;
  unitSize: number;
  quantity: number;
  imageUrl: string | null;
  maxStock: number;
}

interface CartState {
  items: CartItem[];
  // Returns how many units actually went in - less than asked (possibly 0)
  // when stock runs out.
  addItem: (item: Omit<CartItem, "quantity">, quantity: number) => number;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  total: number;
  count: number;
}

const CART_KEY = "bazaar_storefront_cart";
const CartContext = createContext<CartState | undefined>(undefined);

export function cartLineKey(item: Pick<CartItem, "variantId" | "unit">): string {
  return `${item.variantId}:${item.unit}`;
}

export function linePieces(item: Pick<CartItem, "quantity" | "unitSize">): number {
  return item.quantity * item.unitSize;
}

export function lineTotal(item: Pick<CartItem, "quantity" | "unitSize" | "unitPrice">): number {
  return linePieces(item) * item.unitPrice;
}

// Carts saved before boxes/blocks existed have no unit fields - they were
// all sold by the piece.
function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<CartItem>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i): i is CartItem => typeof i?.variantId === "string" && typeof i.quantity === "number" && i.quantity > 0)
      .map((i) => ({ ...i, unit: i.unit ?? "PIECE", unitSize: i.unitSize && i.unitSize > 0 ? i.unitSize : 1 }));
  } catch {
    return [];
  }
}

// The other lines of the same variant draw from the same stock, so a line
// can only grow into whatever pieces they've left.
function maxUnits(items: CartItem[], line: Pick<CartItem, "variantId" | "unit" | "unitSize" | "maxStock">): number {
  const piecesInOtherLines = items
    .filter((i) => i.variantId === line.variantId && i.unit !== line.unit)
    .reduce((sum, i) => sum + linePieces(i), 0);
  return Math.max(0, Math.floor((line.maxStock - piecesInOtherLines) / line.unitSize));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  function addItem(item: Omit<CartItem, "quantity">, quantity: number): number {
    const key = cartLineKey(item);
    const existing = items.find((i) => cartLineKey(i) === key);
    const limit = maxUnits(items, item);
    const nextQuantity = Math.min((existing?.quantity ?? 0) + quantity, limit);
    const added = nextQuantity - (existing?.quantity ?? 0);
    if (added <= 0) return 0;

    setItems(
      existing
        ? // Refresh the snapshot too: price or stock may have changed since the line was first added.
          items.map((i) => (cartLineKey(i) === key ? { ...item, quantity: nextQuantity } : i))
        : [...items, { ...item, quantity: nextQuantity }],
    );
    return added;
  }

  function updateQuantity(key: string, quantity: number) {
    setItems((prev) =>
      prev.map((i) => {
        if (cartLineKey(i) !== key) return i;
        const wanted = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
        return { ...i, quantity: Math.max(1, Math.min(wanted, maxUnits(prev, i))) };
      }),
    );
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => cartLineKey(i) !== key));
  }

  function clear() {
    setItems([]);
  }

  const total = items.reduce((sum, i) => sum + lineTotal(i), 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

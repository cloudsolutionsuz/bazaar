import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "./CartContext";
import * as storefrontApi from "../api/storefront";

export interface MagicBoxRequiredItem {
  id: string;
  variantId: string;
  quantity: number;
  variant: {
    id: string;
    name: string | null;
    sku: string;
    product: { id: string; name: string; images: { url: string }[] };
  };
}

export interface MagicBox {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  items: MagicBoxRequiredItem[];
}

export interface MagicBoxProgress {
  box: MagicBox;
  unlocked: boolean;
  itemProgress: { item: MagicBoxRequiredItem; have: number; need: number }[];
}

interface MagicBoxState {
  boxes: MagicBox[];
  progress: MagicBoxProgress[];
  unlockedBoxes: MagicBox[];
  unlockedIds: string[];
  loading: boolean;
}

const MagicBoxContext = createContext<MagicBoxState | undefined>(undefined);

export function MagicBoxProvider({ children }: { children: ReactNode }) {
  const { items: cartItems } = useCart();
  const query = useQuery({
    queryKey: ["storefront-magic-boxes"],
    queryFn: storefrontApi.listMagicBoxes,
    staleTime: 60_000,
  });

  const boxes: MagicBox[] = query.data?.items ?? [];

  const progress = useMemo<MagicBoxProgress[]>(() => {
    const quantityByVariant = new Map<string, number>();
    for (const item of cartItems) {
      quantityByVariant.set(item.variantId, (quantityByVariant.get(item.variantId) ?? 0) + item.quantity);
    }

    return boxes.map((box) => {
      const itemProgress = box.items.map((req) => ({
        item: req,
        have: Math.min(quantityByVariant.get(req.variantId) ?? 0, req.quantity),
        need: req.quantity,
      }));
      const unlocked = itemProgress.every((p) => p.have >= p.need);
      return { box, unlocked, itemProgress };
    });
  }, [boxes, cartItems]);

  const unlockedBoxes = useMemo(() => progress.filter((p) => p.unlocked).map((p) => p.box), [progress]);
  const unlockedIds = useMemo(() => unlockedBoxes.map((b) => b.id), [unlockedBoxes]);

  return (
    <MagicBoxContext.Provider value={{ boxes, progress, unlockedBoxes, unlockedIds, loading: query.isLoading }}>
      {children}
    </MagicBoxContext.Provider>
  );
}

export function useMagicBoxes(): MagicBoxState {
  const ctx = useContext(MagicBoxContext);
  if (!ctx) throw new Error("useMagicBoxes must be used within MagicBoxProvider");
  return ctx;
}

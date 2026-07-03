import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as productsApi from "../../api/products";
import { Button } from "../../components/ui/Button";
import type { Product } from "../../types/api";

export function ArrangePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [localOrder, setLocalOrder] = useState<Product[] | null>(null);
  const [saved, setSaved] = useState(false);

  const productsQuery = useQuery({
    queryKey: ["products", "arrange"],
    queryFn: () => productsApi.listProducts({ pageSize: 100 }),
    select: (data) => data.items,
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => productsApi.reorderProducts(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setLocalOrder(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const products = localOrder ?? productsQuery.data ?? [];

  function move(index: number, direction: -1 | 1) {
    const base = localOrder ?? productsQuery.data ?? [];
    const newOrder = [...base];
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setLocalOrder(newOrder);
    setSaved(false);
  }

  function handleSave() {
    if (!localOrder) return;
    reorderMutation.mutate(localOrder.map((p) => p.id));
  }

  const hasChanges = localOrder !== null;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/products" className="mb-1 block text-sm text-brand-600 hover:underline">
            ← {t("common.back")}
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{t("products.arrange")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("products.arrangeHint")}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-sm text-green-600">{t("common.saved")}</span>}
          <Button disabled={!hasChanges || reorderMutation.isPending} onClick={handleSave}>
            {t("common.save")}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {products.map((product, index) => (
          <div key={product.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
            {product.images[0] ? (
              <img src={product.images[0].url} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-gray-100" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-900">{product.name}</div>
              <div className="text-xs text-gray-500">{product.price.toLocaleString()} {product.currency}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="secondary" disabled={index === 0} onClick={() => move(index, -1)}>
                ↑
              </Button>
              <Button variant="secondary" disabled={index === products.length - 1} onClick={() => move(index, 1)}>
                ↓
              </Button>
            </div>
          </div>
        ))}
        {products.length === 0 && productsQuery.isFetched && (
          <p className="text-center text-gray-400">{t("common.noData")}</p>
        )}
      </div>
    </div>
  );
}

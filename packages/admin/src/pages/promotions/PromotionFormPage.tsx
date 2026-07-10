import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as promotionsApi from "../../api/promotions";
import * as productsApi from "../../api/products";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { ProductSelectorFields, emptySelectorState, isSelectorValid, selectorToPayload, type SelectorState } from "./ProductSelectorFields";
import type { Product } from "../../types/api";

// ── Variant picker ────────────────────────────────────────────────────────────

interface VariantPickerProps {
  value: { variantId: string; label: string } | null;
  onChange: (v: { variantId: string; label: string } | null) => void;
  placeholder?: string;
}

function variantLabel(product: Product, variantId: string): string {
  const v = product.variants.find((x) => x.id === variantId);
  if (!v) return product.name;
  return v.name ? `${product.name} — ${v.name}` : product.name;
}

function VariantPicker({ value, onChange, placeholder = "Поиск товара…" }: VariantPickerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ["products", "bxgy-picker", search],
    queryFn: () => productsApi.listProducts({ search: search || undefined, pageSize: 30 }),
    enabled: open,
  });

  const products = productsQuery.data?.items ?? [];

  function select(product: Product, variantId: string) {
    onChange({ variantId, label: variantLabel(product, variantId) });
    setOpen(false);
    setSearch("");
    setExpanded(null);
  }

  function clear() {
    onChange(null);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div
        className="flex cursor-pointer items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:border-brand-400"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {value ? value.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clear(); }}
              className="text-gray-400 hover:text-red-500"
            >
              ×
            </button>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="p-2">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск товара…"
              className="w-full"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {products.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">Нет товаров</p>
            )}
            {products.map((product) => (
              <div key={product.id}>
                <div
                  className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    if (product.variants.length === 1) {
                      select(product, product.variants[0].id);
                    } else {
                      setExpanded(expanded === product.id ? null : product.id);
                    }
                  }}
                >
                  <span className="font-medium text-gray-800">{product.name}</span>
                  {product.variants.length > 1 && (
                    <span className="text-xs text-gray-400">{product.variants.length} вариантов ▸</span>
                  )}
                </div>
                {expanded === product.id && product.variants.map((v) => (
                  <div
                    key={v.id}
                    className="cursor-pointer bg-gray-50 py-1.5 pl-6 pr-3 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                    onClick={() => select(product, v.id)}
                  >
                    {v.name ?? v.sku}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PromotionFormPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();

  const promotionQuery = useQuery({
    queryKey: ["promotion", id],
    queryFn: () => promotionsApi.getPromotion(id as string),
    enabled: !!id,
  });

  const [name, setName] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selector, setSelector] = useState<SelectorState>(emptySelectorState());

  // BxGy rule builder state
  const [buyVariant, setBuyVariant] = useState<{ variantId: string; label: string } | null>(null);
  const [buyQty, setBuyQty] = useState("1");
  const [getVariant, setGetVariant] = useState<{ variantId: string; label: string } | null>(null);
  const [getQty, setGetQty] = useState("1");

  useEffect(() => {
    const promotion = promotionQuery.data?.promotion;
    if (promotion) {
      setName(promotion.name);
      setDiscountPercent(promotion.discountPercent ? String(promotion.discountPercent) : "");
      setStartsAt(promotion.startsAt ? promotion.startsAt.slice(0, 10) : "");
      setEndsAt(promotion.endsAt ? promotion.endsAt.slice(0, 10) : "");
      setIsActive(promotion.isActive);
    }
  }, [promotionQuery.data]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["promotion", id] });
    queryClient.invalidateQueries({ queryKey: ["promotions"] });
  }

  const [saved, setSaved] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (input: promotionsApi.PromotionInput) => promotionsApi.updatePromotion(id as string, input),
    onSuccess: () => {
      invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err: unknown) => {
      window.alert(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const attachMutation = useMutation({
    mutationFn: () => promotionsApi.attachProducts(id as string, selectorToPayload(selector)),
    onSuccess: () => {
      invalidate();
      setSelector(emptySelectorState());
    },
  });

  const detachMutation = useMutation({
    mutationFn: (productId: string) => promotionsApi.detachProduct(id as string, productId),
    onSuccess: invalidate,
  });

  const addBxGyMutation = useMutation({
    mutationFn: () => promotionsApi.addBxGyRule(id as string, {
      buyVariantId: buyVariant!.variantId,
      buyQty: Number(buyQty),
      getVariantId: getVariant!.variantId,
      getQty: Number(getQty),
    }),
    onSuccess: () => {
      invalidate();
      setBuyVariant(null);
      setBuyQty("1");
      setGetVariant(null);
      setGetQty("1");
    },
    onError: (err: unknown) => {
      window.alert(err instanceof Error ? err.message : t("common.error"));
    },
  });

  const removeBxGyMutation = useMutation({
    mutationFn: (ruleId: string) => promotionsApi.removeBxGyRule(id as string, ruleId),
    onSuccess: invalidate,
    onError: (err: unknown) => {
      window.alert(err instanceof Error ? err.message : t("common.error"));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      name,
      discountPercent: discountPercent ? Number(discountPercent) : null,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      isActive,
    });
  }

  const canAddBxGy = !!buyVariant && !!getVariant && Number(buyQty) >= 1 && Number(getQty) >= 1;
  const promotion = promotionQuery.data?.promotion;

  return (
    <div>
      <Link to="/promotions" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← {t("common.back")}
      </Link>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t("promotions.editPromotion")}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: edit form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("promotions.name")}</label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.discount")}, %</label>
              <Input type="number" min={0} max={99} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("promotions.startsAt")}</label>
              <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("promotions.endsAt")}</label>
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              {t("promotions.isActive")}
            </label>
            <Button type="submit" disabled={updateMutation.isPending}>
              {saved ? "✓ Сохранено" : updateMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </form>
        </div>

        {/* Right: products + BxGy */}
        {promotion && (
          <div className="space-y-6 lg:col-span-2">
            {/* Attach products */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-3 font-semibold text-gray-900">{t("promotions.attachProducts")}</h2>
              <ProductSelectorFields value={selector} onChange={setSelector} />
              <Button
                type="button"
                className="mt-3"
                disabled={!isSelectorValid(selector) || attachMutation.isPending}
                onClick={() => attachMutation.mutate()}
              >
                {t("promotions.attach")}
              </Button>

              <div className="mt-4">
                <Table>
                  <Thead>
                    <tr>
                      <Th>{t("products.name")}</Th>
                      <Th>{t("common.actions")}</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {promotion.products.map((pp) => (
                      <tr key={pp.productId}>
                        <Td>{pp.product.name}</Td>
                        <Td>
                          <button onClick={() => detachMutation.mutate(pp.productId)} className="text-red-600 hover:underline">
                            {t("promotions.detach")}
                          </button>
                        </Td>
                      </tr>
                    ))}
                    {promotion.products.length === 0 && (
                      <tr><Td colSpan={2} className="text-center text-gray-400">{t("common.noData")}</Td></tr>
                    )}
                  </Tbody>
                </Table>
              </div>
            </div>

            {/* BxGy rules (купи X — получи Y) */}
            <div className="rounded-xl border border-orange-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-lg">🎁</span>
                <div>
                  <h2 className="font-semibold text-gray-900">Правила «Купи X — получи Y»</h2>
                  <p className="text-xs text-gray-500">При покупке указанного количества товара — второй товар достаётся бесплатно</p>
                </div>
              </div>

              {/* Rule builder */}
              <div className="rounded-lg border border-orange-100 bg-orange-50 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Buy side */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-700">Покупает</p>
                    <VariantPicker value={buyVariant} onChange={setBuyVariant} placeholder="Выберите товар…" />
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-gray-600">Кол-во:</span>
                      <Input
                        type="number"
                        min={1}
                        max={999}
                        value={buyQty}
                        onChange={(e) => setBuyQty(e.target.value)}
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-gray-500">шт.</span>
                    </div>
                  </div>

                  {/* Get side */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">Получает бесплатно</p>
                    <VariantPicker value={getVariant} onChange={setGetVariant} placeholder="Выберите промо-товар…" />
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-gray-600">Кол-во:</span>
                      <Input
                        type="number"
                        min={1}
                        max={999}
                        value={getQty}
                        onChange={(e) => setGetQty(e.target.value)}
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-gray-500">шт.</span>
                    </div>
                  </div>
                </div>

                {buyVariant && getVariant && (
                  <p className="mt-3 text-sm text-gray-700">
                    Покупает <span className="font-semibold text-orange-700">{buyQty} × {buyVariant.label}</span>
                    {" → "}
                    получает <span className="font-semibold text-green-700">{getQty} × {getVariant.label}</span> бесплатно
                  </p>
                )}

                <Button
                  type="button"
                  className="mt-3"
                  disabled={!canAddBxGy || addBxGyMutation.isPending}
                  onClick={() => addBxGyMutation.mutate()}
                >
                  Добавить правило
                </Button>
              </div>

              {/* Existing rules */}
              {promotion.bxgyRules.length > 0 && (
                <div className="mt-4">
                  <Table>
                    <Thead>
                      <tr>
                        <Th>Покупает</Th>
                        <Th>Кол-во</Th>
                        <Th>→ Получает</Th>
                        <Th>Кол-во</Th>
                        <Th>{t("common.actions")}</Th>
                      </tr>
                    </Thead>
                    <Tbody>
                      {promotion.bxgyRules.map((rule) => {
                        const buyLabel = rule.buyVariant.name
                          ? `${rule.buyVariant.product.name} — ${rule.buyVariant.name}`
                          : rule.buyVariant.product.name;
                        const getLabel = rule.getVariant.name
                          ? `${rule.getVariant.product.name} — ${rule.getVariant.name}`
                          : rule.getVariant.product.name;
                        return (
                          <tr key={rule.id}>
                            <Td className="text-gray-800">{buyLabel}</Td>
                            <Td>
                              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                                {rule.buyQty} шт.
                              </span>
                            </Td>
                            <Td className="text-gray-800">{getLabel}</Td>
                            <Td>
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                                {rule.getQty} шт.
                              </span>
                            </Td>
                            <Td>
                              <button
                                onClick={() => {
                                  if (window.confirm("Удалить правило?")) removeBxGyMutation.mutate(rule.id);
                                }}
                                className="text-red-600 hover:underline"
                              >
                                {t("common.delete")}
                              </button>
                            </Td>
                          </tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </div>
              )}

              {promotion.bxgyRules.length === 0 && (
                <p className="mt-3 text-center text-sm text-gray-400">Правил ещё нет — добавьте выше</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

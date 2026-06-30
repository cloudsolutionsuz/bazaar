import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as promotionsApi from "../../api/promotions";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { ProductSelectorFields, emptySelectorState, isSelectorValid, selectorToPayload, type SelectorState } from "./ProductSelectorFields";

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

  const updateMutation = useMutation({
    mutationFn: (input: promotionsApi.PromotionInput) => promotionsApi.updatePromotion(id as string, input),
    onSuccess: invalidate,
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

  const promotion = promotionQuery.data?.promotion;

  return (
    <div className="max-w-3xl">
      <Link to="/promotions" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← {t("common.back")}
      </Link>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t("promotions.editPromotion")}</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("promotions.name")}</label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("products.discount")}, %</label>
            <Input type="number" min={0} max={99} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="w-full" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("promotions.startsAt")}</label>
            <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("promotions.endsAt")}</label>
            <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          {t("promotions.isActive")}
        </label>
        <Button type="submit" disabled={updateMutation.isPending}>
          {t("common.save")}
        </Button>
      </form>

      {promotion && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("promotions.attachProducts")}</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <ProductSelectorFields value={selector} onChange={setSelector} />
            <Button
              type="button"
              className="mt-3"
              disabled={!isSelectorValid(selector) || attachMutation.isPending}
              onClick={() => attachMutation.mutate()}
            >
              {t("promotions.attach")}
            </Button>
          </div>

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
                  <tr>
                    <Td colSpan={2} className="text-center text-gray-400">
                      {t("common.noData")}
                    </Td>
                  </tr>
                )}
              </Tbody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}

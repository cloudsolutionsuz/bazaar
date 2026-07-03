import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as promoCodesApi from "../../api/promoCodes";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { NumberInput } from "../../components/ui/NumberInput";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";

export function PromoCodesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const promoCodesQuery = useQuery({ queryKey: ["promo-codes"], queryFn: () => promoCodesApi.listPromoCodes() });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
  }

  const createMutation = useMutation({
    mutationFn: promoCodesApi.createPromoCode,
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setCode("");
      setDiscountValue("");
      setMaxUses("");
      setMinOrderAmount("");
      setExpiresAt("");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: promoCodesApi.deactivatePromoCode,
    onSuccess: invalidate,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const val = Number(discountValue);
    createMutation.mutate({
      code,
      discountPercent: discountType === "percent" ? val : undefined,
      discountFixed: discountType === "fixed" ? val : undefined,
      maxUses: maxUses ? Number(maxUses) : undefined,
      minOrderAmount: minOrderAmount ? Number(minOrderAmount) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    });
  }

  const items = promoCodesQuery.data?.items ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t("promoCodes.title")}</h1>
        {!adding && (
          <Button onClick={() => setAdding(true)}>{t("promoCodes.add")}</Button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("promoCodes.code")}</label>
              <Input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SUMMER20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("promoCodes.discountType")}</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="percent">{t("promoCodes.discountPercent")}</option>
                <option value="fixed">{t("promoCodes.discountFixed")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {discountType === "percent" ? t("promoCodes.discountPercentLabel") : t("promoCodes.discountFixedLabel")}
              </label>
              <Input
                required
                type="number"
                min={1}
                max={discountType === "percent" ? 100 : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("promoCodes.maxUses")}</label>
              <Input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder={t("promoCodes.maxUsesPlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("promoCodes.minOrderAmount")}</label>
              <NumberInput
                min={0}
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="0"
                className="w-full text-left"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("promoCodes.expiresAt")}</label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {t("common.save")}
            </Button>
            <Button variant="secondary" type="button" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
          </div>
          {createMutation.isError && (
            <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
          )}
        </form>
      )}

      <Table>
          <Thead>
            <tr>
              <Th>{t("promoCodes.code")}</Th>
              <Th>{t("promoCodes.discount")}</Th>
              <Th>{t("promoCodes.uses")}</Th>
              <Th>{t("promoCodes.minOrderAmount")}</Th>
              <Th>{t("promoCodes.expiresAt")}</Th>
              <Th>{t("promoCodes.status")}</Th>
              <Th>{""}</Th>
            </tr>
          </Thead>
          <Tbody>
            {items.length === 0 && (
              <tr>
                <Td colSpan={7} className="text-center text-gray-500">
                  {t("promoCodes.empty")}
                </Td>
              </tr>
            )}
            {items.map((promo) => (
              <tr key={promo.id}>
                <Td className="font-mono font-semibold">{promo.code}</Td>
                <Td>
                  {promo.discountPercent != null
                    ? `${promo.discountPercent}%`
                    : `${promo.discountFixed?.toLocaleString()} сум`}
                </Td>
                <Td>
                  {promo.usedCount}
                  {promo.maxUses != null ? ` / ${promo.maxUses}` : ""}
                </Td>
                <Td>{promo.minOrderAmount != null ? promo.minOrderAmount.toLocaleString() : "—"}</Td>
                <Td>
                  {promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString("ru-RU") : "—"}
                </Td>
                <Td>
                  <Badge color={promo.isActive ? "green" : "gray"}>
                    {promo.isActive ? t("promoCodes.active") : t("promoCodes.inactive")}
                  </Badge>
                </Td>
                <Td>
                  {promo.isActive && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (window.confirm(t("promoCodes.confirmDeactivate"))) {
                          deactivateMutation.mutate(promo.id);
                        }
                      }}
                    >
                      {t("promoCodes.deactivate")}
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
    </div>
  );
}

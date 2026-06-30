import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as promotionsApi from "../../api/promotions";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";

export function PromotionsListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const promotionsQuery = useQuery({ queryKey: ["promotions"], queryFn: () => promotionsApi.listPromotions() });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["promotions"] });
  }

  const createMutation = useMutation({
    mutationFn: promotionsApi.createPromotion,
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setName("");
      setDiscountPercent("");
      setStartsAt("");
      setEndsAt("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: promotionsApi.deletePromotion,
    onSuccess: invalidate,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      name,
      discountPercent: discountPercent ? Number(discountPercent) : undefined,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
    });
  }

  const promotions = promotionsQuery.data?.items ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("promotions.title")}</h1>
        {!adding && <Button onClick={() => setAdding(true)}>{t("promotions.add")}</Button>}
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mb-6 max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-6">
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
          <div className="flex gap-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {t("common.save")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}

      <Table>
        <Thead>
          <tr>
            <Th>{t("promotions.name")}</Th>
            <Th>{t("products.discount")}</Th>
            <Th>{t("promotions.startsAt")}</Th>
            <Th>{t("promotions.endsAt")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("promotions.productCount")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {promotions.map((p) => (
            <tr key={p.id}>
              <Td>{p.name}</Td>
              <Td>{p.discountPercent ? `-${p.discountPercent}%` : "—"}</Td>
              <Td>{p.startsAt ? new Date(p.startsAt).toLocaleDateString() : "—"}</Td>
              <Td>{p.endsAt ? new Date(p.endsAt).toLocaleDateString() : "—"}</Td>
              <Td>
                <Badge color={p.isActive ? "green" : "gray"}>{p.isActive ? t("banners.active") : t("banners.inactive")}</Badge>
              </Td>
              <Td>{p._count?.products ?? 0}</Td>
              <Td>
                <div className="flex items-center gap-3">
                  <Link to={`/promotions/${p.id}`} className="text-brand-600 hover:underline">
                    {t("common.edit")}
                  </Link>
                  <button
                    onClick={() => {
                      if (window.confirm(t("promotions.confirmDelete"))) deleteMutation.mutate(p.id);
                    }}
                    className="text-red-600 hover:underline"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </Td>
            </tr>
          ))}
          {promotions.length === 0 && (
            <tr>
              <Td colSpan={7} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>
    </div>
  );
}

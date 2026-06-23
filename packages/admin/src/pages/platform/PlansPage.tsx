import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as plansApi from "../../api/plans";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import type { Plan } from "../../types/api";

interface PlanFormState {
  code: string;
  name: string;
  priceSum: string;
  maxProducts: string;
  maxOrdersPerMonth: string;
  maxEmployees: string;
}

const EMPTY_FORM: PlanFormState = { code: "", name: "", priceSum: "", maxProducts: "", maxOrdersPerMonth: "", maxEmployees: "" };

function planToForm(plan: Plan): PlanFormState {
  return {
    code: plan.code,
    name: plan.name,
    priceSum: String(plan.priceSum),
    maxProducts: plan.maxProducts !== null ? String(plan.maxProducts) : "",
    maxOrdersPerMonth: plan.maxOrdersPerMonth !== null ? String(plan.maxOrdersPerMonth) : "",
    maxEmployees: plan.maxEmployees !== null ? String(plan.maxEmployees) : "",
  };
}

function formToInput(form: PlanFormState): plansApi.PlanInput {
  return {
    code: form.code,
    name: form.name,
    priceSum: Number(form.priceSum),
    maxProducts: form.maxProducts === "" ? null : Number(form.maxProducts),
    maxOrdersPerMonth: form.maxOrdersPerMonth === "" ? null : Number(form.maxOrdersPerMonth),
    maxEmployees: form.maxEmployees === "" ? null : Number(form.maxEmployees),
  };
}

export function PlansPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);

  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: plansApi.listPlans });

  const createMutation = useMutation({
    mutationFn: plansApi.createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setEditingId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: plansApi.PlanInput }) => plansApi.updatePlan(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setEditingId(null);
    },
  });

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function startEdit(plan: Plan) {
    setForm(planToForm(plan));
    setEditingId(plan.id);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input = formToInput(form);
    if (editingId === "new") {
      createMutation.mutate(input);
    } else if (editingId) {
      updateMutation.mutate({ id: editingId, input });
    }
  }

  const plans = plansQuery.data?.plans ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("platform.plansTitle")}</h1>
        {editingId === null && <Button onClick={startCreate}>{t("platform.addPlan")}</Button>}
      </div>

      {editingId !== null && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("platform.planCode")}</label>
              <Input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("platform.planName")}</label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("platform.priceSum")}</label>
              <Input
                required
                type="number"
                min={1}
                value={form.priceSum}
                onChange={(e) => setForm({ ...form, priceSum: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("platform.maxProducts")}</label>
              <Input
                type="number"
                min={1}
                placeholder={t("platform.unlimited")}
                value={form.maxProducts}
                onChange={(e) => setForm({ ...form, maxProducts: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("platform.maxOrdersPerMonth")}</label>
              <Input
                type="number"
                min={1}
                placeholder={t("platform.unlimited")}
                value={form.maxOrdersPerMonth}
                onChange={(e) => setForm({ ...form, maxOrdersPerMonth: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("platform.maxEmployees")}</label>
              <Input
                type="number"
                min={1}
                placeholder={t("platform.unlimited")}
                value={form.maxEmployees}
                onChange={(e) => setForm({ ...form, maxEmployees: e.target.value })}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {t("common.save")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}

      <Table>
        <Thead>
          <tr>
            <Th>{t("platform.planCode")}</Th>
            <Th>{t("platform.planName")}</Th>
            <Th>{t("platform.priceSum")}</Th>
            <Th>{t("platform.maxProducts")}</Th>
            <Th>{t("platform.maxOrdersPerMonth")}</Th>
            <Th>{t("platform.maxEmployees")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {plans.map((plan) => (
            <tr key={plan.id}>
              <Td>{plan.code}</Td>
              <Td>{plan.name}</Td>
              <Td>{plan.priceSum.toLocaleString()}</Td>
              <Td>{plan.maxProducts ?? t("platform.unlimited")}</Td>
              <Td>{plan.maxOrdersPerMonth ?? t("platform.unlimited")}</Td>
              <Td>{plan.maxEmployees ?? t("platform.unlimited")}</Td>
              <Td>
                <button onClick={() => startEdit(plan)} className="text-brand-600 hover:underline">
                  {t("common.edit")}
                </button>
              </Td>
            </tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}

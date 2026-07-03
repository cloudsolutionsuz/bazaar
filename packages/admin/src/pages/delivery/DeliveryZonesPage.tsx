import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as deliveryApi from "../../api/delivery";
import type { DeliveryZone } from "../../types/api";
import { UZBEKISTAN_REGIONS } from "../../data/uzbekistanRegions";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { NumberInput } from "../../components/ui/NumberInput";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";

const REGION_OPTIONS = UZBEKISTAN_REGIONS.map((r) => ({ code: r.code, name: r.name }));

function regionNames(codes: string[]): string {
  return codes
    .map((c) => REGION_OPTIONS.find((r) => r.code === c)?.name ?? c)
    .join(", ");
}

interface ZoneFormState {
  name: string;
  regions: string[];
  cost: string;
  freeAbove: string;
  position: string;
}

const EMPTY_FORM: ZoneFormState = { name: "", regions: [], cost: "", freeAbove: "", position: "0" };

export function DeliveryZonesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [form, setForm] = useState<ZoneFormState>(EMPTY_FORM);

  const zonesQuery = useQuery({ queryKey: ["delivery-zones"], queryFn: deliveryApi.listDeliveryZones });
  const zones = zonesQuery.data?.zones ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
  }

  const createMutation = useMutation({
    mutationFn: (f: ZoneFormState) =>
      deliveryApi.createDeliveryZone({
        name: f.name,
        regions: f.regions,
        cost: Number(f.cost),
        freeAbove: f.freeAbove ? Number(f.freeAbove) : undefined,
        position: f.position ? Number(f.position) : 0,
      }),
    onSuccess: () => { invalidate(); setAdding(false); setForm(EMPTY_FORM); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: string; f: ZoneFormState }) =>
      deliveryApi.updateDeliveryZone(id, {
        name: f.name,
        regions: f.regions,
        cost: Number(f.cost),
        freeAbove: f.freeAbove ? Number(f.freeAbove) : undefined,
        position: f.position ? Number(f.position) : 0,
      }),
    onSuccess: () => { invalidate(); setEditing(null); setForm(EMPTY_FORM); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      deliveryApi.updateDeliveryZone(id, { isActive }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: deliveryApi.deleteDeliveryZone,
    onSuccess: invalidate,
  });

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setAdding(true);
  }

  function openEdit(zone: DeliveryZone) {
    setAdding(false);
    setEditing(zone);
    setForm({
      name: zone.name,
      regions: zone.regions,
      cost: String(zone.cost),
      freeAbove: zone.freeAbove != null ? String(zone.freeAbove) : "",
      position: String(zone.position),
    });
  }

  function cancelForm() {
    setAdding(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, f: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function toggleRegion(code: string) {
    setForm((prev) => ({
      ...prev,
      regions: prev.regions.includes(code)
        ? prev.regions.filter((r) => r !== code)
        : [...prev.regions, code],
    }));
  }

  const isFormOpen = adding || editing != null;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const formError = (createMutation.error || updateMutation.error) as Error | null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t("delivery.title")}</h1>
        {!isFormOpen && (
          <Button onClick={openAdd}>{t("delivery.add")}</Button>
        )}
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-4"
        >
          <h2 className="font-medium text-gray-900">
            {editing ? t("delivery.editZone") : t("delivery.addZone")}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("delivery.zoneName")}</label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder={t("delivery.zoneNamePlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("delivery.cost")}</label>
              <NumberInput
                required
                min={0}
                value={form.cost}
                onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))}
                placeholder="0"
                className="w-full text-left"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("delivery.freeAbove")}</label>
              <NumberInput
                min={0}
                value={form.freeAbove}
                onChange={(e) => setForm((p) => ({ ...p, freeAbove: e.target.value }))}
                placeholder={t("delivery.freeAbovePlaceholder")}
                className="w-full text-left"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("delivery.position")}</label>
              <Input
                type="number"
                min={0}
                value={form.position}
                onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t("delivery.regions")}
              {form.regions.length > 0 && (
                <span className="ml-2 text-indigo-600">({form.regions.length} {t("delivery.selected")})</span>
              )}
            </label>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto rounded border border-gray-200 p-2">
              {REGION_OPTIONS.map((r) => (
                <label key={r.code} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.regions.includes(r.code)}
                    onChange={() => toggleRegion(r.code)}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending || form.regions.length === 0}>
              {t("common.save")}
            </Button>
            <Button variant="secondary" type="button" onClick={cancelForm}>
              {t("common.cancel")}
            </Button>
          </div>
          {formError && <p className="text-sm text-red-600">{formError.message}</p>}
        </form>
      )}

      <Table>
        <Thead>
          <tr>
            <Th>{t("delivery.zoneName")}</Th>
            <Th>{t("delivery.regions")}</Th>
            <Th>{t("delivery.cost")}</Th>
            <Th>{t("delivery.freeAbove")}</Th>
            <Th>{t("delivery.position")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{""}</Th>
          </tr>
        </Thead>
        <Tbody>
          {zones.length === 0 && (
            <tr>
              <Td colSpan={7} className="text-center text-gray-500">
                {t("delivery.empty")}
              </Td>
            </tr>
          )}
          {zones.map((zone) => (
            <tr key={zone.id}>
              <Td className="font-medium">{zone.name}</Td>
              <Td className="max-w-xs truncate text-sm text-gray-600">{regionNames(zone.regions)}</Td>
              <Td>{zone.cost.toLocaleString()} {t("common.sum")}</Td>
              <Td>
                {zone.freeAbove != null
                  ? `${zone.freeAbove.toLocaleString()} ${t("common.sum")}`
                  : "—"}
              </Td>
              <Td>{zone.position}</Td>
              <Td>
                <Badge color={zone.isActive ? "green" : "gray"}>
                  {zone.isActive ? t("common.active") : t("common.inactive")}
                </Badge>
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => openEdit(zone)}>
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => toggleMutation.mutate({ id: zone.id, isActive: !zone.isActive })}
                  >
                    {zone.isActive ? t("common.deactivate") : t("common.activate")}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(t("delivery.confirmDelete"))) {
                        deleteMutation.mutate(zone.id);
                      }
                    }}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as suppliersApi from "../../api/suppliers";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { SupplierFormModal } from "./SupplierFormModal";
import type { Supplier } from "../../types/api";

export function SuppliersListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [adding, setAdding] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const query = useQuery({
    queryKey: ["suppliers", { search: debouncedSearch }],
    queryFn: () => suppliersApi.listSuppliers({ search: debouncedSearch || undefined, pageSize: 100 }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  }

  const createMutation = useMutation({
    mutationFn: suppliersApi.createSupplier,
    onSuccess: () => {
      invalidate();
      setAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: suppliersApi.SupplierInput }) => suppliersApi.updateSupplier(id, input),
    onSuccess: () => {
      invalidate();
      setEditingSupplier(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: suppliersApi.deleteSupplier,
    onSuccess: invalidate,
  });

  const suppliers = query.data?.items ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("suppliers.title")}</h1>
        <Button onClick={() => setAdding(true)}>{t("suppliers.add")}</Button>
      </div>

      <div className="mb-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("suppliers.searchPlaceholder")}
          className="w-full max-w-sm"
        />
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>{t("suppliers.name")}</Th>
            <Th>{t("suppliers.contactPerson")}</Th>
            <Th>{t("suppliers.phone")}</Th>
            <Th>{t("suppliers.address")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {suppliers.map((s) => (
            <tr key={s.id}>
              <Td>{s.name}</Td>
              <Td>{s.contactPerson ?? "—"}</Td>
              <Td>{s.phone ?? "—"}</Td>
              <Td>{s.address ?? "—"}</Td>
              <Td>
                <div className="flex gap-3">
                  <button onClick={() => setEditingSupplier(s)} className="text-brand-600 hover:underline">
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t("suppliers.confirmDelete"))) deleteMutation.mutate(s.id);
                    }}
                    className="text-red-600 hover:underline"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </Td>
            </tr>
          ))}
          {suppliers.length === 0 && (
            <tr>
              <Td colSpan={5} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>

      <SupplierFormModal
        open={adding}
        onClose={() => setAdding(false)}
        submitting={createMutation.isPending}
        onSubmit={(input) => createMutation.mutate(input)}
      />

      <SupplierFormModal
        open={editingSupplier !== null}
        onClose={() => setEditingSupplier(null)}
        submitting={updateMutation.isPending}
        initialValues={
          editingSupplier
            ? {
                name: editingSupplier.name,
                contactPerson: editingSupplier.contactPerson ?? "",
                phone: editingSupplier.phone ?? "",
                address: editingSupplier.address ?? "",
                note: editingSupplier.note ?? "",
              }
            : undefined
        }
        onSubmit={(input) => {
          if (editingSupplier) updateMutation.mutate({ id: editingSupplier.id, input });
        }}
      />
    </div>
  );
}

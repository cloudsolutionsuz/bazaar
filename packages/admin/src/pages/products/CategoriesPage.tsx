import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as categoriesApi from "../../api/categories";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import type { Category } from "../../types/api";

export function CategoriesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data } = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.listCategories });
  const categories = data?.categories ?? [];

  const createMutation = useMutation({
    mutationFn: () => categoriesApi.createCategory({ name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories"] });
      setName("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => categoriesApi.updateCategory(id, { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.deleteCategory(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({ id: editingId, name: editName });
  }

  function handleDelete(id: string) {
    if (!window.confirm(t("categories.confirmDelete"))) return;
    deleteMutation.mutate(id);
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("categories.title")}</h1>

      <form onSubmit={handleCreate} className="mb-6 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("categories.namePlaceholder")}
          className="flex-1"
        />
        <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
          {t("common.add")}
        </Button>
      </form>

      <Table>
        <Thead>
          <tr>
            <Th>{t("categories.name")}</Th>
            <Th>{t("categories.slug")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {categories.map((cat) => (
            <tr key={cat.id}>
              <Td>
                {editingId === cat.id ? (
                  <form onSubmit={handleUpdate} className="flex gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                      autoFocus
                    />
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {t("common.save")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                      {t("common.cancel")}
                    </Button>
                  </form>
                ) : (
                  cat.name
                )}
              </Td>
              <Td className="text-gray-500">{cat.slug}</Td>
              <Td>
                {editingId !== cat.id && (
                  <div className="flex gap-2">
                    <button className="text-sm text-brand-600 hover:underline" onClick={() => startEdit(cat)}>
                      {t("common.edit")}
                    </button>
                    <button
                      className="text-sm text-red-600 hover:underline"
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDelete(cat.id)}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                )}
              </Td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <Td colSpan={3} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>
    </div>
  );
}

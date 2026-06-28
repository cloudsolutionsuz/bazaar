import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as cashRegistersApi from "../../api/cashRegisters";
import { ApiError } from "../../api/client";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";

export function CashRegistersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const registersQuery = useQuery({ queryKey: ["finance", "cash-registers"], queryFn: cashRegistersApi.listCashRegisters });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["finance"] });
  }

  const createMutation = useMutation({
    mutationFn: cashRegistersApi.createCashRegister,
    onSuccess: () => {
      invalidate();
      setName("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: cashRegistersApi.UpdateCashRegisterInput }) =>
      cashRegistersApi.updateCashRegister(id, input),
    onSuccess: invalidate,
    onError: (err) => {
      if (err instanceof ApiError && err.code === "CANNOT_DEACTIVATE_DEFAULT") setError(t("kassa.errorCannotDeactivateDefault"));
      else if (err instanceof ApiError && err.code === "INACTIVE_CANNOT_BE_DEFAULT") setError(t("kassa.errorInactiveCannotBeDefault"));
      else setError(err instanceof Error ? err.message : String(err));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate(name.trim());
  }

  const registers = registersQuery.data?.items ?? [];

  return (
    <Modal open={open} onClose={onClose} title={t("kassa.manageRegisters")}>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <ul className="mb-4 space-y-2">
        {registers.map((register) => (
          <li key={register.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-900">{register.name}</span>
              {register.isDefault && <Badge color="blue">{t("kassa.defaultBadge")}</Badge>}
              <Badge color={register.isActive ? "green" : "gray"}>
                {register.isActive ? t("kassa.active") : t("kassa.inactive")}
              </Badge>
            </div>
            <div className="flex gap-2">
              {!register.isDefault && (
                <Button
                  variant="secondary"
                  disabled={updateMutation.isPending}
                  onClick={() => {
                    setError(null);
                    updateMutation.mutate({ id: register.id, input: { isDefault: true } });
                  }}
                >
                  {t("kassa.setDefault")}
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={updateMutation.isPending}
                onClick={() => {
                  setError(null);
                  updateMutation.mutate({ id: register.id, input: { isActive: !register.isActive } });
                }}
              >
                {register.isActive ? t("kassa.deactivate") : t("kassa.activate")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("kassa.registerName")}
          className="flex-1"
        />
        <Button type="submit" disabled={createMutation.isPending}>
          {t("kassa.addRegister")}
        </Button>
      </form>
    </Modal>
  );
}

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as employeesApi from "../../api/employees";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";

type EmployeeRole = "MANAGER" | "CASHIER";

const ROLE_LABEL_KEYS: Record<string, string> = {
  OWNER: "employees.roleOwner",
  MANAGER: "employees.roleManager",
  CASHIER: "employees.roleCashier",
};

export function EmployeesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EmployeeRole>("CASHIER");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: employeesApi.listEmployees });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  const inviteMutation = useMutation({
    mutationFn: employeesApi.inviteEmployee,
    onSuccess: () => {
      invalidate();
      setInviting(false);
      setName("");
      setEmail("");
      setRole("CASHIER");
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "PLAN_LIMIT_REACHED") setInviteError(t("employees.errorLimitReached"));
      else if (err instanceof ApiError && err.code === "EMAIL_TAKEN") setInviteError(t("employees.errorEmailTaken"));
      else setInviteError(err instanceof Error ? err.message : String(err));
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: EmployeeRole }) => employeesApi.updateEmployeeRole(id, role),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: employeesApi.removeEmployee,
    onSuccess: invalidate,
  });

  function handleInviteSubmit(e: FormEvent) {
    e.preventDefault();
    setInviteError(null);
    inviteMutation.mutate({ name, email, role });
  }

  const employees = employeesQuery.data?.employees ?? [];

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("employees.title")}</h1>
        {!inviting && <Button onClick={() => setInviting(true)}>{t("employees.invite")}</Button>}
      </div>

      {inviting && (
        <form onSubmit={handleInviteSubmit} className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("employees.name")}</label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("employees.email")}</label>
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("employees.role")}</label>
            <Select value={role} onChange={(e) => setRole(e.target.value as EmployeeRole)} className="w-full">
              <option value="CASHIER">{t("employees.roleCashier")}</option>
              <option value="MANAGER">{t("employees.roleManager")}</option>
            </Select>
          </div>
          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={inviteMutation.isPending}>
              {t("employees.sendInvite")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setInviting(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}

      <Table>
        <Thead>
          <tr>
            <Th>{t("employees.name")}</Th>
            <Th>{t("employees.email")}</Th>
            <Th>{t("employees.role")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <Td>{employee.name}</Td>
              <Td>{employee.email}</Td>
              <Td>
                {employee.role === "OWNER" ? (
                  <Badge color="blue">{t(ROLE_LABEL_KEYS[employee.role])}</Badge>
                ) : (
                  <Select
                    value={employee.role}
                    onChange={(e) => updateRoleMutation.mutate({ id: employee.id, role: e.target.value as EmployeeRole })}
                  >
                    <option value="CASHIER">{t("employees.roleCashier")}</option>
                    <option value="MANAGER">{t("employees.roleManager")}</option>
                  </Select>
                )}
              </Td>
              <Td>
                {employee.emailVerifiedAt ? (
                  <Badge color="green">{t("employees.statusActive")}</Badge>
                ) : (
                  <Badge color="yellow">{t("employees.statusInvited")}</Badge>
                )}
              </Td>
              <Td>
                {employee.role !== "OWNER" && employee.id !== user?.id && (
                  <button
                    onClick={() => {
                      if (window.confirm(t("employees.confirmRemove"))) removeMutation.mutate(employee.id);
                    }}
                    className="text-red-600 hover:underline"
                  >
                    {t("common.delete")}
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as agentsApi from "../../api/agents";
import { ApiError } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { AgentFormModal } from "./AgentFormModal";
import { BulkBonusModal } from "./BulkBonusModal";
import { CopyLinkButton } from "./CopyLinkButton";
import { formatBonus } from "./BonusFields";

const SOCIAL_KEYS = ["telegram", "instagram", "youtube", "tiktok"] as const;
const COLUMN_COUNT = 11;

// A handle like "@vali" isn't a URL; only real links become clickable.
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

type FormState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; agent: agentsApi.Agent };

export function AgentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: agentsApi.listAgents });
  const agents = agentsQuery.data?.agents ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["agents"] });
  }

  const toggleMutation = useMutation({
    mutationFn: (agent: agentsApi.Agent) => agentsApi.updateAgent(agent.id, { isActive: !agent.isActive }),
    onSuccess: invalidate,
    onError: () => setActionError(t("agents.errorSave")),
  });

  const deleteMutation = useMutation({
    mutationFn: agentsApi.deleteAgent,
    onSuccess: invalidate,
    onError: (err) => {
      setActionError(err instanceof ApiError && err.code === "AGENT_HAS_HISTORY" ? t("agents.errorHasHistory") : t("agents.errorSave"));
    },
  });

  function handleDelete(agent: agentsApi.Agent) {
    setActionError(null);
    if (window.confirm(t("agents.confirmDelete", { name: agent.fullName }))) deleteMutation.mutate(agent.id);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">{t("agents.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setBulkOpen(true)} disabled={agents.length === 0}>
            {t("agents.bulkBonus")}
          </Button>
          <Button onClick={() => setForm({ mode: "create" })}>{t("agents.addAgent")}</Button>
        </div>
      </div>

      {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}
      {agentsQuery.isError && <p className="mb-3 text-sm text-red-600">{t("common.error")}</p>}

      <Table>
        <Thead>
          <tr>
            <Th>{t("agents.fullName")}</Th>
            <Th>{t("agents.phone")}</Th>
            <Th>{t("agents.socials")}</Th>
            <Th>{t("agents.login")}</Th>
            <Th>{t("agents.link")}</Th>
            <Th>{t("agents.bonus")}</Th>
            <Th>{t("agents.orderCount")}</Th>
            <Th>{t("agents.ordersAmount")}</Th>
            <Th>{t("agents.balance")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {agents.map((agent) => (
            <tr key={agent.id}>
              <Td className="font-medium">{agent.fullName}</Td>
              <Td className="whitespace-nowrap">+{agent.phone}</Td>
              <Td>
                <div className="flex flex-col gap-0.5 text-xs">
                  {SOCIAL_KEYS.map((key) => {
                    const value = agent[key];
                    if (!value) return null;
                    return isHttpUrl(value) ? (
                      <a key={key} href={value} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                        {t(`agents.${key}`)}
                      </a>
                    ) : (
                      <span key={key} className="text-gray-600">
                        {t(`agents.${key}`)}: {value}
                      </span>
                    );
                  })}
                </div>
              </Td>
              <Td className="font-mono text-xs">{agent.login}</Td>
              <Td>
                <CopyLinkButton link={agent.link} />
              </Td>
              <Td className="whitespace-nowrap">{formatBonus(agent.bonusType, agent.bonusValue, t("common.sum"))}</Td>
              <Td>{agent.orderCount}</Td>
              <Td>{agent.ordersAmount.toLocaleString()}</Td>
              <Td className={agent.bonusBalance > 0 ? "font-medium text-red-600" : ""}>{agent.bonusBalance.toLocaleString()}</Td>
              <Td>
                <Badge color={agent.isActive ? "green" : "gray"}>{agent.isActive ? t("common.active") : t("common.inactive")}</Badge>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-3 whitespace-nowrap">
                  <button onClick={() => setForm({ mode: "edit", agent })} className="text-brand-600 hover:underline">
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => {
                      setActionError(null);
                      toggleMutation.mutate(agent);
                    }}
                    disabled={toggleMutation.isPending}
                    className="text-gray-600 hover:underline disabled:opacity-50"
                  >
                    {agent.isActive ? t("common.deactivate") : t("common.activate")}
                  </button>
                  <button onClick={() => handleDelete(agent)} disabled={deleteMutation.isPending} className="text-red-600 hover:underline disabled:opacity-50">
                    {t("common.delete")}
                  </button>
                </div>
              </Td>
            </tr>
          ))}
          {agents.length === 0 && (
            <tr>
              <Td colSpan={COLUMN_COUNT} className="text-center text-gray-400">
                {agentsQuery.isLoading ? t("common.loading") : t("agents.empty")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>

      <AgentFormModal
        open={form.mode !== "closed"}
        agent={form.mode === "edit" ? form.agent : null}
        onClose={() => setForm({ mode: "closed" })}
        onSaved={() => {
          invalidate();
          setForm({ mode: "closed" });
        }}
      />
      <BulkBonusModal
        open={bulkOpen}
        agentCount={agents.length}
        onClose={() => setBulkOpen(false)}
        onSaved={() => {
          invalidate();
          setBulkOpen(false);
        }}
      />
    </div>
  );
}

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import * as agentsApi from "../../api/agents";
import { ApiError } from "../../api/client";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { downloadBlob } from "../../utils/downloadBlob";

const FILE_ERROR_KEYS: Record<string, string> = {
  INVALID_FILE: "agents.importErrorInvalidFile",
  UPLOAD_ERROR: "agents.importErrorInvalidFile",
  EMPTY_FILE: "agents.importErrorEmptyFile",
  TOO_MANY_ROWS: "agents.importErrorTooManyRows",
};

interface AgentsImportModalProps {
  open: boolean;
  onClose: () => void;
  // Called whenever at least one agent was added, so the list can refresh.
  onImported: () => void;
}

// Bulk-adding agents from a spreadsheet: valid rows are created right away,
// bad rows come back with their Excel row number and what was wrong, to be
// fixed in the file and uploaded again.
export function AgentsImportModal({ open, onClose, onImported }: AgentsImportModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<agentsApi.AgentImportResult | null>(null);

  useEffect(() => {
    if (open) {
      setUploading(false);
      setError(null);
      setResult(null);
    }
  }, [open]);

  async function handleTemplate() {
    setError(null);
    try {
      downloadBlob(await agentsApi.downloadImportTemplate(), "agentlar-shablon.xlsx");
    } catch {
      setError(t("common.error"));
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const imported = await agentsApi.importAgents(file);
      setResult(imported);
      if (imported.created > 0) onImported();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(t(FILE_ERROR_KEYS[code] ?? "agents.importErrorUpload"));
    } finally {
      setUploading(false);
    }
  }

  // A known column explains itself better than the generic code does.
  function describe(rowError: agentsApi.AgentImportError): string {
    if (rowError.code === "INVALID" && rowError.field) return t(`agents.importError.${rowError.field}`);
    return t(`agents.importError.${rowError.code}`);
  }

  return (
    <Modal open={open} onClose={onClose} title={t("agents.importTitle")}>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{t("agents.importIntro")}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void handleTemplate()}>
          {t("agents.importTemplate")}
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => void handleFile(e)} />
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? t("common.loading") : t("agents.importChoose")}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="space-y-3">
          <p className={`text-sm font-medium ${result.created > 0 ? "text-green-600" : "text-gray-600 dark:text-gray-300"}`}>
            {result.created > 0 ? "✓ " : ""}
            {t("agents.importCreated", { count: result.created })}
          </p>
          {result.errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
              <p className="mb-2 text-sm font-medium text-red-700 dark:text-red-300">
                {t("agents.importErrorsTitle", { count: result.errors.length })}
              </p>
              <ul className="max-h-60 space-y-1 overflow-y-auto text-sm text-red-700 dark:text-red-300">
                {result.errors.map((rowError) => (
                  <li key={`${rowError.row}-${rowError.code}-${rowError.field ?? ""}`}>
                    <span className="font-medium">{t("agents.importRow", { row: rowError.row })}:</span> {describe(rowError)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}

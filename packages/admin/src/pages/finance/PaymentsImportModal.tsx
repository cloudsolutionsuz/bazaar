import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import * as paymentsImportApi from "../../api/paymentsImport";
import { ApiError } from "../../api/client";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { downloadBlob } from "../../utils/downloadBlob";
import { shortOrderId } from "../../utils/orderId";
import type { CashRegister } from "../../types/api";

const REVALIDATE_DELAY_MS = 600;
const MAX_ROWS = 1000;
const COLUMN_COUNT = 7;

const FILE_ERROR_KEYS: Record<string, string> = {
  INVALID_FILE: "paymentsImport.errorInvalidFile",
  EMPTY_FILE: "paymentsImport.errorEmptyFile",
  TOO_MANY_ROWS: "paymentsImport.errorTooManyRows",
  UPLOAD_ERROR: "paymentsImport.errorInvalidFile",
};

const COMMIT_ERROR_KEYS: Record<string, string> = {
  IMPORT_HAS_ERRORS: "paymentsImport.errorHasErrors",
  IMPORT_CONFLICT: "paymentsImport.errorConflict",
  REGISTER_NOT_FOUND: "paymentsImport.errorRegister",
};

// One editable line. `amount` stays a string while being typed; `preview` is
// what the server last said about this line (null = not checked yet).
interface Row {
  key: string;
  phone: string;
  orderRef: string;
  amount: string;
  description: string;
  preview: paymentsImportApi.PaymentRowPreview | null;
}

function toRow(preview: paymentsImportApi.PaymentRowPreview): Row {
  return {
    key: crypto.randomUUID(),
    phone: preview.phone,
    orderRef: preview.orderRef,
    amount: preview.amount === null ? "" : String(preview.amount),
    description: preview.description,
    preview,
  };
}

function toInput(row: Row): paymentsImportApi.PaymentRowInput {
  const amount = row.amount.trim();
  return {
    phone: row.phone.trim(),
    orderRef: row.orderRef.trim(),
    // Anything but a whole number goes up as null and comes back INVALID_AMOUNT.
    amount: /^\d+$/.test(amount) ? Number(amount) : null,
    description: row.description.trim(),
  };
}

interface PaymentsImportModalProps {
  open: boolean;
  onClose: () => void;
  activeRegisters: CashRegister[];
  defaultRegisterId: string;
}

// Money-in from a spreadsheet: upload -> every row is matched to a customer
// (by phone) or an order (by ID) and shown with what it would pay off ->
// rows with problems are fixed right here -> only when nothing is wrong can
// the whole batch be posted to the Kassa.
export function PaymentsImportModal({ open, onClose, activeRegisters, defaultRegisterId }: PaymentsImportModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Each validation request gets a number; a reply is only applied if it is
  // still the latest one asked for, so slow replies can't undo newer edits.
  const requestSeq = useRef(0);

  const [rows, setRows] = useState<Row[]>([]);
  const [registerId, setRegisterId] = useState(defaultRegisterId);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"idle" | "uploading" | "validating" | "committing">("idle");
  const [error, setError] = useState<string | null>(null);
  // A failed check leaves the rows unverified with nothing scheduled to
  // retry - this is what offers the manual "check again".
  const [checkFailed, setCheckFailed] = useState(false);
  const [done, setDone] = useState<{ imported: number; totalAmount: number } | null>(null);

  useEffect(() => {
    if (open) {
      requestSeq.current += 1;
      setRows([]);
      setRegisterId(defaultRegisterId);
      setDirty(false);
      setBusy("idle");
      setError(null);
      setCheckFailed(false);
      setDone(null);
    }
  }, [open, defaultRegisterId]);

  // Re-check the rows shortly after the last edit.
  useEffect(() => {
    if (!open || !dirty || rows.length === 0) return;
    const timer = setTimeout(() => void revalidate(rows), REVALIDATE_DELAY_MS);
    return () => clearTimeout(timer);
    // revalidate is recreated every render; rows/dirty are the real triggers.
  }, [open, dirty, rows]);

  async function revalidate(current: Row[]) {
    const seq = ++requestSeq.current;
    setBusy("validating");
    if (checkFailed) setError(null);
    setCheckFailed(false);
    try {
      const result = await paymentsImportApi.validateRows(current.map(toInput));
      if (seq !== requestSeq.current) return;
      setRows(current.map((row, i) => ({ ...row, preview: result.rows[i] ?? null })));
      setDirty(false);
    } catch {
      if (seq !== requestSeq.current) return;
      setError(t("paymentsImport.errorValidate"));
      setCheckFailed(true);
    } finally {
      if (seq === requestSeq.current) setBusy("idle");
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const seq = ++requestSeq.current;
    setError(null);
    setDone(null);
    setBusy("uploading");
    try {
      const result = await paymentsImportApi.parseFile(file);
      if (seq !== requestSeq.current) return;
      setRows(result.rows.map(toRow));
      setDirty(false);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const code = err instanceof ApiError ? err.code : "";
      setError(t(FILE_ERROR_KEYS[code] ?? "paymentsImport.errorUpload"));
    } finally {
      if (seq === requestSeq.current) setBusy("idle");
    }
  }

  async function handleTemplate() {
    try {
      downloadBlob(await paymentsImportApi.downloadTemplate(), "tolovlar-shablon.xlsx");
    } catch {
      setError(t("common.error"));
    }
  }

  // Any edit makes a check that is still in flight obsolete: its answer
  // describes rows that no longer exist in that form and must be dropped,
  // not written back over what the user has typed since.
  function discardPendingCheck() {
    requestSeq.current += 1;
    setBusy((current) => (current === "validating" ? "idle" : current));
    setError(null);
    setCheckFailed(false);
  }

  function updateRow(key: string, field: "phone" | "orderRef" | "amount" | "description", value: string) {
    discardPendingCheck();
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value, preview: null } : row)));
    setDirty(true);
    setDone(null);
  }

  function removeRow(key: string) {
    discardPendingCheck();
    const next = rows.filter((row) => row.key !== key);
    setRows(next);
    // Removing a row frees the debt it had claimed for the rows after it.
    setDirty(next.length > 0);
  }

  function addRow() {
    discardPendingCheck();
    setRows((prev) => [...prev, { key: crypto.randomUUID(), phone: "", orderRef: "", amount: "", description: "", preview: null }]);
    setDirty(true);
    setDone(null);
  }

  async function handleCommit() {
    setError(null);
    setBusy("committing");
    try {
      const result = await paymentsImportApi.commitRows(rows.map(toInput), registerId);
      setDone(result);
      setRows([]);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer"] });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(t(COMMIT_ERROR_KEYS[code] ?? "paymentsImport.errorCommit"));
      // The server's view moved on (or disagreed) - show its current verdict.
      if (code === "IMPORT_HAS_ERRORS" || code === "IMPORT_CONFLICT") setDirty(true);
    } finally {
      setBusy("idle");
    }
  }

  const checked = rows.length > 0 && !dirty && rows.every((row) => row.preview !== null);
  const errorCount = rows.filter((row) => row.preview?.status === "error").length;
  const totalAmount = rows.reduce((sum, row) => sum + (toInput(row).amount ?? 0), 0);
  const canCommit = checked && errorCount === 0 && busy === "idle" && registerId !== "";

  return (
    <Modal open={open} onClose={onClose} title={t("paymentsImport.title")} size="wide" closeOnBackdrop={false}>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{t("paymentsImport.intro")}</p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Button variant="secondary" onClick={() => void handleTemplate()}>
          {t("paymentsImport.downloadTemplate")}
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => void handleFile(e)} />
        <Button onClick={() => fileInputRef.current?.click()} disabled={busy !== "idle"}>
          {busy === "uploading" ? t("common.loading") : t("paymentsImport.chooseFile")}
        </Button>
        <div className="ml-auto">
          <label className="mb-1 block text-xs text-gray-500">{t("kassa.register")}</label>
          <Select value={registerId} onChange={(e) => setRegisterId(e.target.value)}>
            {activeRegisters.map((register) => (
              <option key={register.id} value={register.id}>
                {register.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {done && (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          ✓ {t("paymentsImport.success", { count: done.imported, amount: done.totalAmount.toLocaleString() })}
        </p>
      )}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {rows.length > 0 && (
        <>
          <Table>
            <Thead>
              <tr>
                <Th>№</Th>
                <Th>{t("paymentsImport.phone")}</Th>
                <Th>{t("paymentsImport.orderId")}</Th>
                <Th>{t("kassa.amount")}</Th>
                <Th>{t("paymentsImport.note")}</Th>
                <Th>{t("paymentsImport.result")}</Th>
                <Th>{t("common.actions")}</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map((row, index) => (
                <tr key={row.key} className={row.preview?.status === "error" ? "bg-red-50 dark:bg-red-900/20" : ""}>
                  <Td className="text-gray-400">{index + 1}</Td>
                  <Td>
                    <Input
                      value={row.phone}
                      maxLength={40}
                      inputMode="tel"
                      onChange={(e) => updateRow(row.key, "phone", e.target.value.replace(/[^\d+\s()-]/g, ""))}
                      placeholder="901234567"
                      className="w-36"
                    />
                  </Td>
                  <Td>
                    <Input value={row.orderRef} maxLength={64} onChange={(e) => updateRow(row.key, "orderRef", e.target.value)} placeholder="#1a2b3c4d" className="w-36 font-mono" />
                  </Td>
                  <Td>
                    <Input
                      value={row.amount}
                      inputMode="numeric"
                      onChange={(e) => updateRow(row.key, "amount", e.target.value.replace(/\D/g, ""))}
                      className="w-32"
                    />
                  </Td>
                  <Td>
                    <Input value={row.description} maxLength={500} onChange={(e) => updateRow(row.key, "description", e.target.value)} className="w-40" />
                  </Td>
                  <Td>
                    <RowResult preview={row.preview} />
                  </Td>
                  <Td>
                    <button onClick={() => removeRow(row.key)} className="text-red-600 hover:underline">
                      {t("common.delete")}
                    </button>
                  </Td>
                </tr>
              ))}
              <tr>
                <Td colSpan={COLUMN_COUNT}>
                  <button onClick={addRow} disabled={rows.length >= MAX_ROWS} className="text-sm text-brand-600 hover:underline disabled:opacity-50">
                    + {t("paymentsImport.addRow")}
                  </button>
                </Td>
              </tr>
            </Tbody>
          </Table>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="space-y-1">
              <div className="text-gray-600 dark:text-gray-300">
                {t("paymentsImport.rowsTotal", { count: rows.length })} ·{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">{totalAmount.toLocaleString()}</span>
              </div>
              {checkFailed && busy === "idle" ? (
                <button onClick={() => void revalidate(rows)} className="font-medium text-brand-600 hover:underline">
                  {t("paymentsImport.checkAgain")}
                </button>
              ) : busy === "validating" || !checked ? (
                <div className="text-gray-500">{t("paymentsImport.checking")}</div>
              ) : errorCount > 0 ? (
                <div className="font-medium text-red-600">{t("paymentsImport.errorsFound", { count: errorCount })}</div>
              ) : (
                <div className="font-medium text-green-600">✓ {t("paymentsImport.allGood")}</div>
              )}
            </div>
            <Button onClick={() => void handleCommit()} disabled={!canCommit}>
              {busy === "committing" ? t("common.saving") : t("paymentsImport.commit", { amount: totalAmount.toLocaleString() })}
            </Button>
          </div>
        </>
      )}

      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}

function RowResult({ preview }: { preview: paymentsImportApi.PaymentRowPreview | null }) {
  const { t } = useTranslation();
  if (!preview) return <span className="text-gray-400">…</span>;

  const who = preview.customerName ? (
    <div className="text-xs text-gray-600 dark:text-gray-300">
      {preview.customerName}
      {preview.orderIds.length > 0 && <span className="ml-1 font-mono text-gray-400">{preview.orderIds.map(shortOrderId).join(", ")}</span>}
    </div>
  ) : null;

  if (preview.status === "error") {
    return (
      <div>
        <div className="font-medium text-red-600">{t(`paymentsImport.rowError.${preview.errorCode}`)}</div>
        {who}
        {preview.debtBefore !== null && preview.errorCode === "OVERPAID" && (
          <div className="text-xs text-gray-600 dark:text-gray-300">{t("paymentsImport.debt", { amount: preview.debtBefore.toLocaleString() })}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="font-medium text-green-600">✓ {t("paymentsImport.rowOk")}</div>
      {who}
      {preview.debtBefore !== null && preview.debtAfter !== null && (
        <div className="text-xs text-gray-600 dark:text-gray-300">
          {t("paymentsImport.debtChange", { before: preview.debtBefore.toLocaleString(), after: preview.debtAfter.toLocaleString() })}
        </div>
      )}
    </div>
  );
}

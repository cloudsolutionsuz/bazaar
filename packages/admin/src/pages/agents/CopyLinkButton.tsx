import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const COPIED_FEEDBACK_MS = 2000;

// The agent's referral link with a one-click copy. The link itself stays
// selectable, so it can still be copied by hand where the clipboard API is
// unavailable (plain-http pages, old browsers).
export function CopyLinkButton({ link }: { link: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [state]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex max-w-xs items-center gap-2">
      <span className="min-w-0 flex-1 select-all truncate font-mono text-xs text-gray-600 dark:text-gray-300" title={link}>
        {link}
      </span>
      <button type="button" onClick={() => void handleCopy()} className="shrink-0 text-xs text-brand-600 hover:underline">
        {state === "copied" ? t("agents.linkCopied") : state === "failed" ? t("agents.linkCopyFailed") : t("agents.copyLink")}
      </button>
    </div>
  );
}

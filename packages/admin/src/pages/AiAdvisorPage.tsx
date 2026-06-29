import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import * as aiAdvisorApi from "../api/aiAdvisor";
import { ApiError } from "../api/client";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

const HISTORY_LIMIT = 10;

export function AiAdvisorPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<aiAdvisorApi.AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;

    const history = messages.slice(-HISTORY_LIMIT);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const result = await aiAdvisorApi.ask(question, history);
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer }]);
    } catch (err) {
      if (err instanceof ApiError && err.code === "AI_NOT_CONFIGURED") {
        setNotConfigured(true);
      } else {
        setError(t("aiAdvisor.errorGeneric"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{t("aiAdvisor.title")}</h1>

      {notConfigured ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">{t("aiAdvisor.notConfigured")}</div>
      ) : (
        <>
          <div className="mb-3 flex-1 space-y-3 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
            {messages.length === 0 && <p className="text-sm text-gray-400">{t("aiAdvisor.hint")}</p>}
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-md whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    message.role === "user" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {loading && <p className="text-sm text-gray-400">{t("aiAdvisor.thinking")}</p>}
          </div>

          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("aiAdvisor.placeholder")}
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              {t("aiAdvisor.send")}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

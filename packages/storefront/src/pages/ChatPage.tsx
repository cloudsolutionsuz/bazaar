import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as storefrontApi from "../api/storefront";

export function ChatPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [identified, setIdentified] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const query = useQuery({
    queryKey: ["chat-messages", phone],
    queryFn: () => storefrontApi.getChatMessages(phone),
    enabled: identified,
    refetchInterval: identified ? 5000 : false,
  });
  const messages = query.data?.messages ?? [];

  function handleIdentify(e: FormEvent) {
    e.preventDefault();
    setIdentified(true);
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await storefrontApi.sendChatMessage(phone, name, text.trim());
      setText("");
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", phone] });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 font-display text-2xl font-bold text-gray-900">{t("chat.title")}</h1>
      <p className="mb-4 text-sm text-gray-600">{t("chat.hint")}</p>

      {!identified ? (
        <form onSubmit={handleIdentify} className="space-y-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("chat.namePlaceholder")}
            className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
          />
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("checkout.phone")}
            className="w-full rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-clay-600 px-4 py-2 text-sm font-medium text-white hover:bg-clay-700"
          >
            {t("chat.start")}
          </button>
        </form>
      ) : (
        <>
          <div className="mb-4 space-y-2 rounded-xl border border-clay-200 bg-white p-4">
            {messages.length === 0 && <p className="text-sm text-gray-500">{t("chat.empty")}</p>}
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === "CUSTOMER" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                    message.sender === "CUSTOMER" ? "bg-clay-600 text-white" : "bg-sand-100 text-gray-900"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("chat.messagePlaceholder")}
              className="flex-1 rounded-md border border-clay-200 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="rounded-md bg-clay-600 px-4 py-2 text-sm font-medium text-white hover:bg-clay-700 disabled:opacity-50"
            >
              {t("chat.send")}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

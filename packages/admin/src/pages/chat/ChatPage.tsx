import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as chatApi from "../../api/chat";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";

export function ChatPage() {
  const { t } = useTranslation();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const threadsQuery = useQuery({
    queryKey: ["chat", "threads"],
    queryFn: chatApi.listThreads,
    refetchInterval: 5000,
  });
  const threads = threadsQuery.data?.items ?? [];

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="w-72 flex-shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-white">
        <h1 className="border-b border-gray-200 p-4 text-lg font-semibold text-gray-900">{t("chat.title")}</h1>
        {threads.length === 0 && <p className="p-4 text-sm text-gray-400">{t("chat.noThreads")}</p>}
        <ul>
          {threads.map((thread) => (
            <li key={thread.customerId}>
              <button
                onClick={() => setSelectedCustomerId(thread.customerId)}
                className={`block w-full border-b border-gray-100 p-3 text-left hover:bg-gray-50 ${
                  selectedCustomerId === thread.customerId ? "bg-brand-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{thread.customerName}</span>
                  {thread.unreadCount > 0 && <Badge color="green">{thread.unreadCount}</Badge>}
                </div>
                <div className="text-xs text-gray-500">{thread.customerPhone}</div>
                <div className="mt-1 truncate text-sm text-gray-600">{thread.lastMessageText}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 rounded-xl border border-gray-200 bg-white">
        {selectedCustomerId ? <ThreadDetail customerId={selectedCustomerId} /> : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">{t("chat.selectThread")}</div>
        )}
      </div>
    </div>
  );
}

function ThreadDetail({ customerId }: { customerId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const query = useQuery({
    queryKey: ["chat", "thread", customerId],
    queryFn: () => chatApi.getThreadMessages(customerId),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (messageText: string) => chatApi.sendMessage(customerId, messageText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      setText("");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    sendMutation.mutate(text.trim());
  }

  const data = query.data;
  if (!data) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 p-4">
        <div className="text-sm font-medium text-gray-900">{data.customer.name}</div>
        <div className="text-xs text-gray-500">{data.customer.phone}</div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {data.messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender === "STAFF" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                message.sender === "STAFF" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-900"
              }`}
            >
              {message.text}
              <div className={`mt-1 text-xs ${message.sender === "STAFF" ? "text-brand-100" : "text-gray-400"}`}>
                {new Date(message.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {data.messages.length === 0 && <p className="text-sm text-gray-400">{t("common.noData")}</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.messagePlaceholder")}
          className="flex-1"
        />
        <Button type="submit" disabled={sendMutation.isPending || !text.trim()}>
          {t("chat.send")}
        </Button>
      </form>
    </div>
  );
}

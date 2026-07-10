import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as supportApi from "../../api/support";
import type { SupportChatThread, SupportMessage } from "../../types/api";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function SupportPage() {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const chatsQuery = useQuery({
    queryKey: ["support-chats"],
    queryFn: supportApi.listChats,
    refetchInterval: 20_000,
  });

  const messagesQuery = useQuery({
    queryKey: ["support-admin-messages", selectedTenantId],
    queryFn: () => supportApi.getTenantMessages(selectedTenantId!),
    enabled: !!selectedTenantId,
    refetchInterval: 10_000,
  });

  const replyMutation = useMutation({
    mutationFn: (t: string) => supportApi.replyToTenant(selectedTenantId!, t),
    onSuccess: () => {
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["support-admin-messages", selectedTenantId] });
      void queryClient.invalidateQueries({ queryKey: ["support-chats"] });
      void queryClient.invalidateQueries({ queryKey: ["support-admin-unread"] });
    },
  });

  // Scroll to bottom when messages load
  useEffect(() => {
    if (messagesQuery.data) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [messagesQuery.data]);

  // Invalidate chats when a thread is selected (unread count resets server-side)
  useEffect(() => {
    if (selectedTenantId) {
      void queryClient.invalidateQueries({ queryKey: ["support-chats"] });
    }
  }, [selectedTenantId, queryClient]);

  function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || replyMutation.isPending || !selectedTenantId) return;
    replyMutation.mutate(t);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const threads: SupportChatThread[] = chatsQuery.data?.items ?? [];
  const messages: SupportMessage[] = messagesQuery.data?.messages ?? [];
  const selectedThread = threads.find((t) => t.tenantId === selectedTenantId);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Чат с разработчиком</h1>

      <div className="flex h-[calc(100vh-180px)] min-h-96 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {/* Thread list */}
        <div className="flex w-64 shrink-0 flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Магазины</p>
            {chatsQuery.isLoading && <p className="text-xs text-gray-400">Загрузка…</p>}
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 && !chatsQuery.isLoading && (
              <p className="px-4 py-6 text-center text-xs text-gray-400">Нет обращений</p>
            )}
            {threads.map((thread) => (
              <button
                key={thread.tenantId}
                onClick={() => setSelectedTenantId(thread.tenantId)}
                className={`w-full border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800 ${
                  selectedTenantId === thread.tenantId
                    ? "bg-indigo-50 dark:bg-indigo-900/20"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {thread.tenantName}
                  </span>
                  <span className="shrink-0 text-[10px] text-gray-400">{formatTime(thread.lastAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="flex-1 truncate text-xs text-gray-500 dark:text-gray-400">
                    {thread.lastSender === "SUPER_ADMIN" ? "Вы: " : ""}{thread.lastText}
                  </p>
                  {thread.unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {thread.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation */}
        <div className="flex flex-1 flex-col">
          {!selectedTenantId ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-400 dark:bg-indigo-900/30">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Выберите магазин</p>
              <p className="mt-1 text-xs text-gray-400">Нажмите на магазин слева для просмотра чата</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="shrink-0 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedThread?.tenantName ?? "…"}</p>
                <p className="text-xs text-gray-400">Магазин — чат с поддержкой</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {messagesQuery.isLoading && (
                  <p className="text-center text-xs text-gray-400 py-4">Загрузка…</p>
                )}
                {!messagesQuery.isLoading && messages.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-8">Нет сообщений</p>
                )}
                {messages.map((msg) => {
                  const isMe = msg.sender === "SUPER_ADMIN";
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                          isMe
                            ? "rounded-br-sm bg-indigo-600 text-white"
                            : "rounded-bl-sm bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                        }`}
                      >
                        {!isMe && (
                          <p className="mb-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                            {selectedThread?.tenantName}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <p className={`mt-1 text-[10px] ${isMe ? "text-indigo-200" : "text-gray-400"}`}>
                          {new Date(msg.createdAt).toLocaleString("ru-RU", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Reply box */}
              <form onSubmit={handleSend} className="shrink-0 border-t border-gray-100 px-4 py-3 dark:border-gray-700">
                <div className="flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ответить магазину…"
                    rows={1}
                    maxLength={5000}
                    className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    style={{ maxHeight: "120px" }}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 120) + "px";
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() || replyMutation.isPending}
                    className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Отправить
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-gray-400">Enter — отправить, Shift+Enter — новая строка</p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

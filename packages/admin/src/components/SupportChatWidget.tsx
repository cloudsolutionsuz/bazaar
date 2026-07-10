import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as supportApi from "../api/support";
import type { SupportMessage } from "../types/api";

function SupportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="13" y2="14" />
    </svg>
  );
}

interface Props {
  unread: number;
}

export function SupportChatWidget({ unread }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ["support-messages"],
    queryFn: supportApi.getMessages,
    refetchInterval: open ? 15_000 : false,
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: (t: string) => supportApi.sendMessage(t),
    onSuccess: () => {
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["support-messages"] });
      void queryClient.invalidateQueries({ queryKey: ["support-unread"] });
    },
  });

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll to bottom when messages load or popover opens
  useEffect(() => {
    if (open && messagesQuery.data) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [open, messagesQuery.data]);

  // Invalidate unread count when popover closes (messages were marked read server-side)
  useEffect(() => {
    if (!open) {
      void queryClient.invalidateQueries({ queryKey: ["support-unread"] });
    }
  }, [open, queryClient]);

  function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || sendMutation.isPending) return;
    sendMutation.mutate(t);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const messages: SupportMessage[] = messagesQuery.data?.messages ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Чат с разработчиком"
        className={`relative rounded-md p-1.5 transition-colors ${
          open
            ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-700/20 dark:text-indigo-400"
            : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        }`}
      >
        <SupportIcon />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-0.5 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 flex w-80 flex-col rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
          style={{ height: "420px" }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-2 rounded-t-xl border-b border-gray-100 bg-indigo-50 px-4 py-3 dark:border-gray-700 dark:bg-indigo-900/30">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Поддержка</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Чат с разработчиком</p>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messagesQuery.isLoading && (
              <p className="text-center text-xs text-gray-400">Загрузка…</p>
            )}
            {!messagesQuery.isLoading && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-400 dark:bg-indigo-900/30">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Напишите нам</p>
                <p className="mt-1 text-xs text-gray-400">Мы ответим в ближайшее время</p>
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender === "TENANT";
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      isMe
                        ? "rounded-br-sm bg-indigo-600 text-white"
                        : "rounded-bl-sm bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                    }`}
                  >
                    {!isMe && (
                      <p className="mb-0.5 text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">Разработчик</p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <p className={`mt-1 text-[10px] ${isMe ? "text-indigo-200" : "text-gray-400"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="shrink-0 border-t border-gray-100 px-3 py-2 dark:border-gray-700">
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Написать сообщение…"
                rows={1}
                maxLength={5000}
                className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                style={{ maxHeight: "100px" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 100) + "px";
                }}
              />
              <button
                type="submit"
                disabled={!text.trim() || sendMutation.isPending}
                className="shrink-0 rounded-xl bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Enter — отправить, Shift+Enter — новая строка</p>
          </form>
        </div>
      )}
    </div>
  );
}

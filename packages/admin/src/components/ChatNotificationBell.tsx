import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import * as chatApi from "../api/chat";

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

type PermState = "default" | "granted" | "denied" | "unsupported";

interface Props {
  unread: number;
}

export function ChatNotificationBell({ unread }: Props) {
  const [open, setOpen] = useState(false);
  const [permState, setPermState] = useState<PermState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermState("unsupported");
      return;
    }
    setPermState(Notification.permission as PermState);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleSubscribe() {
    if (permState === "unsupported") return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const permission = await Notification.requestPermission();
      setPermState(permission as PermState);
      if (permission !== "granted") {
        setStatusMsg("Разрешите уведомления в настройках браузера");
        setLoading(false);
        return;
      }
      const { publicKey } = await chatApi.getPushVapidKey();
      if (!publicKey) { setStatusMsg("Push не настроен на сервере"); setLoading(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = pushSub.toJSON();
      await chatApi.subscribePush({ endpoint: json.endpoint!, p256dh: json.keys!.p256dh, auth: json.keys!.auth });
      setSubscribed(true);
      setStatusMsg("✓ Уведомления включены");
    } catch {
      setStatusMsg("Не удалось подписаться");
    }
    setLoading(false);
  }

  async function handleUnsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();
      setSubscribed(false);
      setStatusMsg("Уведомления отключены");
    } catch {
      setStatusMsg("Ошибка при отключении");
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative rounded-md p-1.5 transition-colors ${
          subscribed
            ? "text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-700/20"
            : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        }`}
        title="Уведомления чата"
      >
        <BellIcon active={subscribed} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
          {/* Header */}
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Чат</p>
            {unread > 0 ? (
              <p className="text-xs text-red-500 font-medium">{unread} непрочитанных</p>
            ) : (
              <p className="text-xs text-gray-400">Нет новых сообщений</p>
            )}
          </div>

          {/* Go to chat */}
          <div className="px-3 py-2">
            <Link
              to="/chat"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-700/20"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Открыть чат
              {unread > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
              )}
            </Link>
          </div>

          {/* Push toggle */}
          <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-700">
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Push-уведомления</p>
            {permState === "unsupported" ? (
              <p className="text-xs text-gray-400">Браузер не поддерживает push</p>
            ) : permState === "denied" ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">Уведомления заблокированы в настройках браузера</p>
            ) : subscribed ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">● Включены</span>
                <button onClick={() => void handleUnsubscribe()} className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400">Отключить</button>
              </div>
            ) : (
              <button
                onClick={() => void handleSubscribe()}
                disabled={loading}
                className="w-full rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? "Подключение..." : "Включить уведомления"}
              </button>
            )}
            {statusMsg && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{statusMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as chatApi from "../api/chat";

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

type PermState = "default" | "granted" | "denied" | "unsupported";

export function ChatNotificationBell() {
  const navigate = useNavigate();
  const [permState, setPermState] = useState<PermState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data } = useQuery({
    queryKey: ["chat-unread-count"],
    queryFn: chatApi.getUnreadCount,
    refetchInterval: 30_000,
  });
  const unread = data?.count ?? 0;

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermState("unsupported");
      return;
    }
    setPermState(Notification.permission as PermState);
    // Check if we already have an active SW push subscription
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub)),
    ).catch(() => {});
  }, []);

  function showTooltip(msg: string) {
    setTooltip(msg);
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => setTooltip(null), 3000);
  }

  async function handleClick() {
    if (permState === "unsupported") {
      navigate("/chat");
      return;
    }

    if (subscribed) {
      navigate("/chat");
      return;
    }

    // Request permission + subscribe
    try {
      const permission = await Notification.requestPermission();
      setPermState(permission as PermState);
      if (permission !== "granted") {
        showTooltip("Разрешите уведомления в браузере");
        return;
      }

      const { publicKey } = await chatApi.getPushVapidKey();
      if (!publicKey) {
        navigate("/chat");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = pushSub.toJSON();
      await chatApi.subscribePush({
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      });

      setSubscribed(true);
      showTooltip("Уведомления включены!");
      navigate("/chat");
    } catch {
      showTooltip("Не удалось подписаться на уведомления");
    }
  }

  const title = subscribed
    ? `Чат — уведомления включены${unread > 0 ? ` (${unread} новых)` : ""}`
    : "Включить уведомления о новых сообщениях";

  return (
    <div className="relative">
      <button
        onClick={() => void handleClick()}
        title={title}
        className={`relative rounded-md p-1.5 transition-colors ${
          subscribed
            ? "text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-700/20"
            : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        }`}
      >
        <BellIcon active={subscribed} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {tooltip && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {tooltip}
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

import webpush from "web-push";
import { env } from "../config/env";

let initialized = false;

function init() {
  if (initialized || !env.vapidPublicKey || !env.vapidPrivateKey) return;
  webpush.setVapidDetails(env.vapidMailto, env.vapidPublicKey, env.vapidPrivateKey);
  initialized = true;
}

export function getVapidPublicKey(): string | null {
  return env.vapidPublicKey;
}

export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return;
  init();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
  } catch {
    // Subscription may have expired - caller handles cleanup if needed
  }
}

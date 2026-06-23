import { env } from "../config/env";

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  console.log(`[email] Verification link for ${to}: ${env.landingUrl}/verify-email?token=${token}`);
}

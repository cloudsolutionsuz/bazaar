import { env } from "../config/env";

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  console.log(`[email] Verification link for ${to}: ${env.landingUrl}/verify-email?token=${token}`);
}

export async function sendEmployeeInviteEmail(to: string, token: string): Promise<void> {
  console.log(`[email] Employee invite link for ${to}: ${env.adminUrl}/accept-invite?token=${token}`);
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  console.log(`[email] Verification link for ${to}: /api/auth/verify-email?token=${token}`);
}

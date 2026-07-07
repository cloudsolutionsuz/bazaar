import nodemailer from "nodemailer";
import { env } from "../config/env";

function getTransport() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) return null;
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.log(`[email] To: ${to} | Subject: ${subject}\n${html.replace(/<[^>]+>/g, "")}`);
    return;
  }
  await transport.sendMail({ from: env.smtpFrom, to, subject, html });
}

export async function sendEmployeeInviteEmail(to: string, token: string): Promise<void> {
  const link = `${env.adminUrl}/accept-invite?token=${token}`;
  await send(
    to,
    "Приглашение в UBazaar",
    `<p>Вас пригласили в UBazaar. Перейдите по ссылке, чтобы задать пароль:</p><p><a href="${link}">${link}</a></p>`,
  );
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${env.adminUrl}/reset-password?token=${token}`;
  await send(
    to,
    "Сброс пароля UBazaar",
    `<p>Вы запросили сброс пароля для UBazaar.</p>
     <p><a href="${link}">Нажмите здесь, чтобы задать новый пароль</a></p>
     <p>Ссылка действительна 1 час. Если вы не запрашивали сброс — просто проигнорируйте это письмо.</p>`,
  );
}

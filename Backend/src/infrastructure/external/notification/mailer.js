import nodemailer from 'nodemailer';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

let transport;

function getTransport() {
  if (!env.EMAIL_HOST) return null;
  transport ??= nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_PORT === 465, // 465 = implicit TLS, 587 = STARTTLS
    requireTLS: env.EMAIL_PORT !== 465 && env.isProduction,
    auth: env.EMAIL_USER ? { user: env.EMAIL_USER, pass: env.EMAIL_PASS } : undefined,
    pool: true,
    maxConnections: 5,
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transport;
}

// Throws on failure so the BullMQ job retries. Never logs recipients' content (may hold OTPs/links).
export async function sendMail({ to, subject, html, text }) {
  const smtp = getTransport();
  if (!smtp) {
    logger.warn({ subject }, 'SMTP not configured; email skipped');
    return null;
  }
  const info = await smtp.sendMail({ from: env.EMAIL_FROM, to, subject, html, text });
  logger.info({ messageId: info.messageId, subject }, 'Email sent');
  return info.messageId;
}

export async function closeMailer() {
  transport?.close();
  transport = undefined;
}

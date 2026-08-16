type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

import { logger } from "@/lib/observability/logger";

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const DEFAULT_RESEND_API_URL = "https://api.resend.com/emails";

function resendApiUrl() {
  const url = new URL(process.env.RESEND_API_URL?.trim() || DEFAULT_RESEND_API_URL);
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("RESEND_API_URL doit utiliser HTTPS ou un loopback HTTP pour les tests.");
  }
  return url.href;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY et EMAIL_FROM sont requis en production.");
    }
    logger.info("email.dev_skipped", { subject: message.subject });
    return { id: "development-skip" };
  }
  const apiUrl = resendApiUrl();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, ...message }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch (error) {
      if (attempt === 3) {
        logger.error("email.provider_error", error, { provider: "resend", attempts: attempt });
        throw new Error("Le fournisseur email est temporairement indisponible.");
      }
      await delay(100 * 2 ** (attempt - 1));
      continue;
    }
    if (response.ok) {
      const payload = await response.json().catch(() => ({})) as { id?: string };
      logger.info("email.sent", { provider: "resend", attempt });
      return { id: payload.id ?? "accepted" };
    }
    if (!RETRYABLE_STATUS.has(response.status)) {
      throw new Error(`Échec d’envoi email (${response.status}).`);
    }
    if (attempt === 3) {
      logger.error("email.provider_error", new Error(`Resend HTTP ${response.status}`), { provider: "resend", attempts: attempt });
      throw new Error("Le fournisseur email est temporairement indisponible.");
    }
    await delay(100 * 2 ** (attempt - 1));
  }
  throw new Error("Le fournisseur email est temporairement indisponible.");
}

export function authEmailTemplate(title: string, text: string, actionLabel: string, actionUrl: string) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
    <h1 style="color:#2563eb">${escape(title)}</h1>
    <p>${escape(text)}</p>
    <p><a href="${escape(actionUrl)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#2563eb;color:white;text-decoration:none;font-weight:700">${escape(actionLabel)}</a></p>
    <p style="font-size:12px;color:#64748b">Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>
  </div>`;
}

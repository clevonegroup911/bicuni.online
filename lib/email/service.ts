type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY et EMAIL_FROM sont requis en production.");
    }
    console.info(`[BICUNI email dev] ${message.subject} -> ${message.to}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, ...message }),
  });

  if (!response.ok) {
    throw new Error(`Échec d’envoi email (${response.status}).`);
  }
}

export function authEmailTemplate(title: string, text: string, actionLabel: string, actionUrl: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
    <h1 style="color:#2563eb">${title}</h1>
    <p>${text}</p>
    <p><a href="${actionUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#2563eb;color:white;text-decoration:none;font-weight:700">${actionLabel}</a></p>
    <p style="font-size:12px;color:#64748b">Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>
  </div>`;
}

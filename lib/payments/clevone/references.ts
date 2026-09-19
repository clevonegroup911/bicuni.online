import { createHash, randomBytes } from "node:crypto";

export function newPublicRef(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replaceAll("-", "");
  const token = randomBytes(4).toString("hex").toUpperCase();
  return `CLEV-${stamp}-${token}`;
}

export function newReceiptNumber(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replaceAll("-", "");
  const token = randomBytes(3).toString("hex").toUpperCase();
  return `RCU-${stamp}-${token}`;
}

export function receiptFingerprint(input: {
  publicNumber: string;
  invoiceRef: string;
  amountCents: number;
  currency: string;
  channel: string;
  confirmedAt: string;
}) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET est requis pour signer un reçu.");
  return createHash("sha256")
    .update(`${secret}:${input.publicNumber}:${input.invoiceRef}:${input.amountCents}:${input.currency}:${input.channel}:${input.confirmedAt}`)
    .digest("hex");
}

export function maskPhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.length < 4) return "•••";
  return `${digits.slice(0, 4)}•••${digits.slice(-3)}`;
}

export function maskAccount(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 6) return "••••";
  return `${compact.slice(0, 4)}••••${compact.slice(-4)}`;
}

export function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "•••";
  return `${local.slice(0, 1)}•••@${domain}`;
}

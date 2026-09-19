import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function authKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET est requis pour le MFA.");
  return createHash("sha256").update(secret).digest();
}

export function generateTotpSecret() {
  return randomBytes(20);
}

export function encryptSecret(plain: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", authKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string) {
  const [iv, tag, encrypted] = payload.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Secret MFA illisible.");
  const decipher = createDecipheriv("aes-256-gcm", authKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]);
}

export function totpCode(secret: Buffer, step = Math.floor(Date.now() / 30_000)) {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(step / 0x100000000), 0);
  buffer.writeUInt32BE(step >>> 0, 4);
  const hmac = createHmac("sha1", secret).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: Buffer, code: string) {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const step = Math.floor(Date.now() / 30_000);
  const provided = Buffer.from(normalized);
  return [step - 1, step, step + 1].some((candidate) => {
    const expected = Buffer.from(totpCode(secret, candidate));
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  });
}

export function toBase32(buffer: Buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

export function otpauthUrl(email: string, secret: Buffer) {
  return `otpauth://totp/BICUNI:${encodeURIComponent(email)}?secret=${toBase32(secret)}&issuer=BICUNI&algorithm=SHA1&digits=6&period=30`;
}

export function mfaRequiredForConfirm(environment = process.env.NODE_ENV) {
  return environment === "production" || process.env.CLEVONE_REQUIRE_MFA === "1";
}

export function hashRecoveryCode(code: string) {
  return createHmac("sha256", authKey()).update(code.replace(/\s+/g, "").toUpperCase()).digest("hex");
}

export function generateRecoveryCodes(count = 8) {
  const codes = Array.from({ length: count }, () => randomBytes(5).toString("hex").toUpperCase());
  return {
    codes,
    hashes: codes.map(hashRecoveryCode),
  };
}

export function verifyRecoveryCode(hashes: string[], code: string) {
  const hashed = Buffer.from(hashRecoveryCode(code));
  const index = hashes.findIndex((candidate) => {
    const expected = Buffer.from(candidate);
    return expected.length === hashed.length && timingSafeEqual(expected, hashed);
  });
  return index;
}

export const MFA_LOCK_AFTER = 5;
export const MFA_LOCK_MS = 15 * 60_000;

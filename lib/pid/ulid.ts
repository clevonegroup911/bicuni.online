import { randomBytes } from "node:crypto";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateUlid(now = Date.now()) {
  if (!Number.isFinite(now) || now < 0 || now > 281474976710655) {
    throw new Error("Horodatage ULID invalide.");
  }
  return encodeTime(Math.floor(now)) + encodeRandom();
}

function encodeTime(timestamp: number) {
  let remaining = timestamp;
  let result = "";
  for (let i = 0; i < 10; i += 1) {
    result = ENCODING[remaining % 32] + result;
    remaining = Math.floor(remaining / 32);
  }
  return result;
}

function encodeRandom() {
  const bytes = randomBytes(10);
  let bits = 0n;
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte);
  let result = "";
  for (let i = 0; i < 16; i += 1) {
    result = ENCODING[Number(bits & 31n)] + result;
    bits >>= 5n;
  }
  return result;
}

import { ALLOWED_PROOF_MIME } from "./types";

const MAGIC: Array<{ mime: (typeof ALLOWED_PROOF_MIME)[number]; test: (bytes: Uint8Array) => boolean }> = [
  { mime: "image/jpeg", test: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mime: "image/png", test: (bytes) => bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  { mime: "application/pdf", test: (bytes) => bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d },
];

export function looksLikeExecutable(bytes: Uint8Array) {
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) return true;
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return true;
  if (bytes.length >= 2 && bytes[0] === 0x23 && bytes[1] === 0x21) return true;
  return false;
}

export function detectProofMime(bytes: Uint8Array) {
  if (looksLikeExecutable(bytes)) return null;
  return MAGIC.find((candidate) => candidate.test(bytes))?.mime ?? null;
}

export function assertAllowedProof(declaredMime: string, bytes: Uint8Array) {
  const detected = detectProofMime(bytes);
  if (!detected) return { ok: false as const, reason: "Type de fichier refusé." };
  if (declaredMime !== detected) return { ok: false as const, reason: "Le type déclaré ne correspond pas au contenu." };
  return { ok: true as const, mime: detected };
}

export function isAllowedProofMime(value: string): value is (typeof ALLOWED_PROOF_MIME)[number] {
  return ALLOWED_PROOF_MIME.some((mime) => mime === value);
}

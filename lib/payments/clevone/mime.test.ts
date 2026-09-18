import { describe, expect, it } from "vitest";
import { assertAllowedProof, detectProofMime } from "./mime";

describe("preuves MIME", () => {
  it("reconnaît JPEG PNG PDF et refuse le reste", () => {
    expect(detectProofMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(detectProofMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectProofMime(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("application/pdf");
    expect(detectProofMime(Uint8Array.from([0x00, 0x01]))).toBeNull();
    expect(detectProofMime(Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });

  it("exige que le type déclaré corresponde au contenu", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
    expect(assertAllowedProof("image/jpeg", jpeg).ok).toBe(true);
    expect(assertAllowedProof("application/pdf", jpeg).ok).toBe(false);
  });
});

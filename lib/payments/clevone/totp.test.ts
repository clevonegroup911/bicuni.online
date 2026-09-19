import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateRecoveryCodes, generateTotpSecret, totpCode, verifyRecoveryCode, verifyTotp } from "./totp";

describe("TOTP CLEVONE", () => {
  it("chiffre et vérifie un code courant", () => {
    process.env.AUTH_SECRET = "test-secret-for-totp-clevone-module";
    const secret = generateTotpSecret();
    const packed = encryptSecret(secret);
    expect(packed).not.toContain(secret.toString("hex"));
    expect(verifyTotp(decryptSecret(packed), totpCode(decryptSecret(packed)))).toBe(true);
    expect(verifyTotp(decryptSecret(packed), "000000")).toBe(false);
    const recovery = generateRecoveryCodes(2);
    expect(recovery.codes).toHaveLength(2);
    expect(verifyRecoveryCode(recovery.hashes, recovery.codes[0])).toBe(0);
    expect(verifyRecoveryCode(recovery.hashes, "nope")).toBe(-1);
  });
});

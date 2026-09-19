import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClevonePaymentError } from "./types";
import { quoteChannelAmount } from "./amount";
import { assertSameOrigin } from "./http";
import { assertAllowedProof } from "./mime";
import { assertTransition, canActivate } from "./state-machine";

describe("contrôles négatifs CLEVONE", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_APP_URL", "https://bicuni.online");
    vi.stubEnv("NODE_ENV", "test");
  });

  it("refuse une origine CSRF invalide", () => {
    expect(() => assertSameOrigin(new Request("https://bicuni.online/api", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }))).toThrow(ClevonePaymentError);
  });

  it("refuse un MIME falsifié et un exécutable", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
    expect(assertAllowedProof("application/pdf", jpeg).ok).toBe(false);
    expect(assertAllowedProof("image/jpeg", Uint8Array.from([0x4d, 0x5a, 0x90])).ok).toBe(false);
  });

  it("refuse CDF sans taux et conserve USD", () => {
    expect(() => quoteChannelAmount({ priceCents: 200, currency: "USD", channel: "MPESA" })).toThrow(/aucun taux/);
    expect(quoteChannelAmount({ priceCents: 200, currency: "USD", channel: "RAWBANK_USD" }).currency).toBe("USD");
  });

  it("interdit PROOF_SUBMITTED → PAID et l’activation hors PAID", () => {
    expect(() => assertTransition("PROOF_SUBMITTED", "PAID")).toThrow(/interdite/);
    expect(canActivate("PROOF_SUBMITTED")).toBe(false);
    expect(canActivate("REVIEW_REQUIRED")).toBe(false);
    expect(canActivate("PAID")).toBe(true);
  });
});

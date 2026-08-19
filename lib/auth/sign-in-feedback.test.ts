import { describe, expect, it } from "vitest";
import { AuthRateLimitedError, AuthTemporarilyUnavailableError } from "./credentials-errors";
import { signInFailureKind, signInFailureMessage } from "./sign-in-feedback";

describe("retours de connexion", () => {
  it("conserve un échec générique pour de mauvais identifiants", () => {
    expect(signInFailureKind("credentials")).toBe("invalid");
    expect(signInFailureMessage("credentials")).toMatch(/Identifiants invalides/);
  });

  it("distingue une limite atteinte sans révéler le compte", () => {
    expect(new AuthRateLimitedError().code).toBe("rate_limited");
    expect(signInFailureKind("rate_limited")).toBe("rate_limited");
    expect(signInFailureMessage("rate_limited")).toMatch(/Trop de tentatives/);
  });

  it("distingue une indisponibilité Redis comme temporaire", () => {
    expect(new AuthTemporarilyUnavailableError().code).toBe("temporarily_unavailable");
    expect(signInFailureKind("temporarily_unavailable")).toBe("temporarily_unavailable");
    expect(signInFailureMessage("temporarily_unavailable")).toMatch(/momentanément indisponible/);
  });
});

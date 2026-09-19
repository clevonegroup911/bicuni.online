import { afterEach, describe, expect, it, vi } from "vitest";
import { ClevonePaymentError } from "./types";
import { allowedCsrfOrigins, assertSameOrigin } from "./http";

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(url: string, headers: HeadersInit, method = "POST") {
  return new Request(url, { method, headers });
}

describe("CSRF CLEVONE", () => {
  it("accepte une origine configurée (same-origin)", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://bicuni.online");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertSameOrigin(request("https://bicuni.online/api/payments/clevone/checkout", {
      origin: "https://bicuni.online",
    }))).not.toThrow();
  });

  it("refuse une origine malveillante même si Host correspond", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://bicuni.online");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertSameOrigin(request("https://bicuni.online/api/payments/clevone/checkout", {
      origin: "https://attacker.example",
      host: "bicuni.online",
    }))).toThrow(ClevonePaymentError);
  });

  it("refuse un Host falsifié : Origin égal au Host attaquant", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://bicuni.online");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertSameOrigin(request("https://attacker.example/api/payments/clevone/checkout", {
      origin: "https://attacker.example",
      host: "attacker.example",
    }))).toThrow(/Origine/);
  });

  it("refuse un X-Forwarded-Host non présent dans l’allowlist", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://bicuni.online");
    vi.stubEnv("TRUSTED_PROXY_STRATEGY", "cloud-run");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertSameOrigin(request("http://10.0.0.8/api/payments/clevone/checkout", {
      origin: "https://evil.example",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    }))).toThrow(ClevonePaymentError);
  });

  it("accepte un proxy de confiance seulement si Origin est déjà autorisée", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://bicuni.online");
    vi.stubEnv("TRUSTED_PROXY_STRATEGY", "cloud-run");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertSameOrigin(request("http://10.0.0.8/api/payments/clevone/checkout", {
      origin: "https://bicuni.online",
      "x-forwarded-host": "bicuni.online",
      "x-forwarded-proto": "https",
    }))).not.toThrow();
  });

  it("en test, autorise localhost et 127.0.0.1 pour la même origine locale", () => {
    vi.stubEnv("PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NODE_ENV", "test");
    expect(allowedCsrfOrigins("test").has("http://127.0.0.1:3000")).toBe(true);
    expect(() => assertSameOrigin(request("http://localhost:3000/api/payments/clevone/checkout", {
      origin: "http://127.0.0.1:3000",
    }))).not.toThrow();
  });

  it("refuse une mutation sans Origin en production", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://bicuni.online");
    expect(() => assertSameOrigin(request("https://bicuni.online/api/payments/clevone/checkout", {
      host: "bicuni.online",
    }, "POST"), "production")).toThrow(/Origine/);
  });
});

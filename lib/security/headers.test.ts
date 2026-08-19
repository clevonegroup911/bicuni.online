import { afterEach, describe, expect, it } from "vitest";
import { contentSecurityPolicy, nextRendererCspHeaders, securityHeaders, shouldSendHsts } from "./headers";

const originalOrigins = {
  publicAppUrl: process.env.PUBLIC_APP_URL,
  authUrl: process.env.AUTH_URL,
  appUrl: process.env.APP_URL,
};

afterEach(() => {
  restore("PUBLIC_APP_URL", originalOrigins.publicAppUrl);
  restore("AUTH_URL", originalOrigins.authUrl);
  restore("APP_URL", originalOrigins.appUrl);
});

describe("security headers", () => {
  it("produit une CSP de production avec nonce, sans unsafe-eval ni unsafe-inline script", () => {
    process.env.PUBLIC_APP_URL = "https://bicuni.online";
    const policy = contentSecurityPolicy("production", "test-nonce");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).toContain("'nonce-test-nonce'");
    expect(policy).toContain("strict-dynamic");
    expect(policy).toContain("img-src 'self' data: blob: https://storage.googleapis.com");
    expect(policy).not.toMatch(/img-src[^;]*(?:^|\s)https:(?:\s|;|$)/);
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toMatch(/(?:^|\s)\*(?:\s|;|$)/);
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(policy.match(/unsafe-inline/g)).toEqual(["unsafe-inline"]);
  });

  it("réserve unsafe-eval au développement", () => {
    expect(contentSecurityPolicy("development", "dev-nonce")).toContain("unsafe-eval");
    expect(contentSecurityPolicy("development", "dev-nonce")).not.toContain("upgrade-insecure-requests");
  });

  it.each(["http://127.0.0.1:3170", "http://localhost:3170"])(
    "ne force pas HTTPS pour un smoke production local sur %s",
    (origin) => {
      process.env.PUBLIC_APP_URL = origin;
      expect(contentSecurityPolicy("production", "test-nonce")).not.toContain("upgrade-insecure-requests");
    },
  );

  it("active le surclassement uniquement pour l’origine publique HTTPS réelle", () => {
    process.env.PUBLIC_APP_URL = "https://app.bicuni.online";
    expect(contentSecurityPolicy("production", "test-nonce")).toContain("upgrade-insecure-requests");
  });

  it("n’active pas le surclassement avec une origine absente ou mal configurée", () => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.AUTH_URL;
    process.env.APP_URL = "not-a-url";
    expect(contentSecurityPolicy("production", "test-nonce")).not.toContain("upgrade-insecure-requests");
  });

  it("expose la CSP sur les en-têtes de requête pour que Next.js applique la nonce", () => {
    const headers = nextRendererCspHeaders("test-nonce", "production");
    expect(headers["x-nonce"]).toBe("test-nonce");
    expect(headers["Content-Security-Policy"]).toContain("'nonce-test-nonce'");
    expect(headers["Content-Security-Policy"]).toContain("strict-dynamic");
    expect(headers["Content-Security-Policy"]).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("ajoute HSTS uniquement en production HTTPS", () => {
    expect(shouldSendHsts("production", true)).toBe(true);
    expect(shouldSendHsts("production", false)).toBe(false);
    expect(shouldSendHsts("development", true)).toBe(false);
    expect(Object.fromEntries(securityHeaders("production", { https: true, nonce: "n" }).map(({ key, value }) => [key, value]))).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    });
    expect(Object.fromEntries(securityHeaders("production", { https: false, nonce: "n" }).map(({ key, value }) => [key, value])))
      .not.toHaveProperty("Strict-Transport-Security");
  });
});

function restore(key: "PUBLIC_APP_URL" | "AUTH_URL" | "APP_URL", value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

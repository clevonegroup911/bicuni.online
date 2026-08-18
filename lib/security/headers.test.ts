import { afterEach, describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./headers";

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
  it("produit une CSP de production stricte sans joker ni unsafe-eval", () => {
    process.env.PUBLIC_APP_URL = "https://bicuni.online";
    const policy = contentSecurityPolicy("production");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).toContain("img-src 'self' data: blob: https://storage.googleapis.com");
    expect(policy).not.toMatch(/img-src[^;]*(?:^|\s)https:(?:\s|;|$)/);
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toMatch(/(?:^|\s)\*(?:\s|;|$)/);
    expect(policy.match(/unsafe-inline/g)).toHaveLength(2);
  });

  it("réserve les assouplissements Next dev au développement", () => {
    expect(contentSecurityPolicy("development")).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(contentSecurityPolicy("development")).not.toContain("upgrade-insecure-requests");
  });

  it.each(["http://127.0.0.1:3170", "http://localhost:3170"])(
    "ne force pas HTTPS pour un smoke production local sur %s",
    (origin) => {
      process.env.PUBLIC_APP_URL = origin;
      expect(contentSecurityPolicy("production")).not.toContain("upgrade-insecure-requests");
    },
  );

  it("active le surclassement uniquement pour l’origine publique HTTPS réelle", () => {
    process.env.PUBLIC_APP_URL = "https://app.bicuni.online";
    expect(contentSecurityPolicy("production")).toContain("upgrade-insecure-requests");
  });

  it("n’active pas le surclassement avec une origine absente ou mal configurée", () => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.AUTH_URL;
    process.env.APP_URL = "not-a-url";
    expect(contentSecurityPolicy("production")).not.toContain("upgrade-insecure-requests");
  });

  it("expose les protections complémentaires", () => {
    expect(Object.fromEntries(securityHeaders("production").map(({ key, value }) => [key, value]))).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
  });
});

function restore(key: "PUBLIC_APP_URL" | "AUTH_URL" | "APP_URL", value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

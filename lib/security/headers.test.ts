import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./headers";

describe("security headers", () => {
  it("produit une CSP de production stricte sans joker ni unsafe-eval", () => {
    const policy = contentSecurityPolicy("production");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).toContain("img-src 'self' data: blob: https:");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toMatch(/(?:^|\s)\*(?:\s|;|$)/);
    expect(policy.match(/unsafe-inline/g)).toHaveLength(2);
  });

  it("réserve les assouplissements Next dev au développement", () => {
    expect(contentSecurityPolicy("development")).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(contentSecurityPolicy("development")).not.toContain("upgrade-insecure-requests");
  });

  it("expose les protections complémentaires", () => {
    expect(Object.fromEntries(securityHeaders("production").map(({ key, value }) => [key, value]))).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
  });
});

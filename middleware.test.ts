import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

describe("protection des routes administratives", () => {
  it("redirige un visiteur anonyme vers la connexion administrateur", () => {
    const response = proxy(new NextRequest("https://bicuni.online/admin/dashboard"));
    expect(response.headers.get("location")).toBe("https://bicuni.online/admin/login?next=%2Fadmin%2Fdashboard");
  });
  it("protège aussi /admin sans segment supplémentaire", () => {
    const response = proxy(new NextRequest("https://bicuni.online/admin"));
    expect(response.headers.get("location")).toBe("https://bicuni.online/admin/login?next=%2Fadmin");
  });
  it("laisse la page de connexion accessible", () => {
    const response = proxy(new NextRequest("https://bicuni.online/admin/login"));
    expect(response.headers.get("location")).toBeNull();
  });
  it("refuse une API admin documents anonyme avec 401", async () => {
    const response = proxy(new NextRequest("https://bicuni.online/api/admin/documents"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentification administrative requise." });
  });

  it.each([
    ["http://127.0.0.1:3170/dashboard", "127.0.0.1:3170", "http://127.0.0.1:3170/login?next=%2Fdashboard"],
    ["http://localhost:3171/dashboard/documents", "localhost:3171", "http://localhost:3171/login?next=%2Fdashboard%2Fdocuments"],
    ["https://app.bicuni.online/dashboard", "app.bicuni.online", "https://app.bicuni.online/login?next=%2Fdashboard"],
  ])("préserve l’origine validée de %s", (requestUrl, host, expectedLocation) => {
    const response = proxy(new NextRequest(requestUrl, { headers: { host } }));
    expect(response.headers.get("location")).toBe(expectedLocation);
  });

  it("ignore un en-tête Host différent de l’URL validée par Next", () => {
    const request = new NextRequest("https://app.bicuni.online/dashboard", {
      headers: { host: "attacker.example" },
    });
    expect(proxy(request).headers.get("location")).toBe("https://app.bicuni.online/login?next=%2Fdashboard");
  });

  it("ajoute HSTS uniquement sur une requête HTTPS de production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const https = proxy(new NextRequest("https://bicuni.online/"));
    expect(https.headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains");
    expect(https.headers.get("content-security-policy")).toContain("nonce-");
    expect(https.headers.get("content-security-policy")).not.toMatch(/script-src[^;]*unsafe-inline/);

    const http = proxy(new NextRequest("http://127.0.0.1:3170/"));
    expect(http.headers.get("strict-transport-security")).toBeNull();
  });
});

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

describe("protection des routes administratives", () => {
  it("redirige un visiteur anonyme vers la connexion administrateur", () => {
    const response = middleware(new NextRequest("https://bicuni.online/admin/dashboard"));
    expect(response.headers.get("location")).toBe("https://bicuni.online/admin/login?next=%2Fadmin%2Fdashboard");
  });
  it("protège aussi /admin sans segment supplémentaire", () => {
    const response = middleware(new NextRequest("https://bicuni.online/admin"));
    expect(response.headers.get("location")).toBe("https://bicuni.online/admin/login?next=%2Fadmin");
  });
  it("laisse la page de connexion accessible", () => {
    const response = middleware(new NextRequest("https://bicuni.online/admin/login"));
    expect(response.headers.get("location")).toBeNull();
  });
  it("refuse une API admin documents anonyme avec 401", async () => {
    const response = middleware(new NextRequest("https://bicuni.online/api/admin/documents"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentification administrative requise." });
  });
});

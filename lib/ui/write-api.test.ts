import { describe, expect, it } from "vitest";
import { interpretWriteStatus, parseWriteResponse, sessionLoginHref } from "./write-api";

describe("write API client", () => {
  it("redirige vers la connexion avec next=", () => {
    expect(sessionLoginHref("/dashboard/profile")).toBe("/login?next=%2Fdashboard%2Fprofile");
  });

  it("traite 401 comme session expirée", () => {
    expect(interpretWriteStatus(401)).toMatchObject({ ok: false, kind: "session" });
  });

  it("ne convertit jamais 404/501 en succès", () => {
    expect(interpretWriteStatus(404).ok).toBe(false);
    expect(interpretWriteStatus(404).kind).toBe("missing");
    expect(interpretWriteStatus(501).kind).toBe("missing");
    expect(interpretWriteStatus(405).kind).toBe("missing");
  });

  it("lit un JSON 200 comme succès réel uniquement", async () => {
    const response = new Response(JSON.stringify({ name: "Ada" }), { status: 200, headers: { "content-type": "application/json" } });
    await expect(parseWriteResponse<{ name: string }>(response)).resolves.toEqual({ ok: true, data: { name: "Ada" } });
  });

  it("conserve le message serveur sur une validation", async () => {
    const response = new Response(JSON.stringify({ error: "ORCID déjà utilisé.", fields: { orcid: "pris" } }), { status: 409 });
    await expect(parseWriteResponse(response)).resolves.toMatchObject({
      ok: false,
      kind: "conflict",
      message: "ORCID déjà utilisé.",
      fields: { orcid: "pris" },
    });
  });
});

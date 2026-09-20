import { describe, expect, it } from "vitest";
import { buildAcademicResearchGraph, runAcademicResearchTask } from "@/lib/oaas/packs/academic-research";

describe("academic research pack", () => {
  const mission = {
    title: "Revue climat",
    originalRequest: "Cartographier les sources fournies sur le climat urbain",
    expectedOutcome: "Dossier de recherche vérifié sur climat urbain",
    academicDomain: "géographie",
    academicLevel: "Master",
    language: "fr",
    scope: "sources client uniquement",
    exclusions: "pas d’invention",
    sources: [
      { label: "Rapport client A", uri: "https://example.org/a", accessible: true, notes: null },
      { label: "Source inaccessible", uri: null, accessible: false, notes: "paywall" },
    ],
  };

  it("construit un graphe avec revue humaine", () => {
    const graph = buildAcademicResearchGraph();
    expect(graph.some((t) => t.requiresHuman)).toBe(true);
    expect(graph.find((t) => t.key === "verify-sources")?.agentKey).toBe("source-verification");
  });

  it("n’invente aucune source dans la synthèse", async () => {
    const result = await runAcademicResearchTask({ taskKey: "synthesis", mission });
    expect(result.inventedContent).toBe(false);
    const content = result.deliverables.find((d) => d.key === "sourced-synthesis")?.content as {
      claims: Array<{ linkedSources: string[] }>;
    };
    expect(content.claims[0].linkedSources).toEqual(["Rapport client A"]);
  });

  it("signale les sources inaccessibles sans les inventer", async () => {
    const result = await runAcademicResearchTask({ taskKey: "verify-sources", mission });
    const rejected = (result.deliverables.find((d) => d.key === "rejected-sources")?.content as {
      rejected: Array<{ status: string }>;
    }).rejected;
    expect(rejected.some((r) => r.status === "rejected_inaccessible")).toBe(true);
  });

  it("ne fabrique pas de DOI", async () => {
    const withBad = {
      ...mission,
      sources: [{ label: "Bad DOI", uri: "https://doi.org/10.999/not valid!", accessible: true, notes: null }],
    };
    const result = await runAcademicResearchTask({ taskKey: "verify-sources", mission: withBad });
    const verified = (result.payload as { verified: Array<{ status: string; invalidDois: string[] }> }).verified;
    expect(verified[0].status).toBe("doi_format_invalid");
    expect(verified[0].invalidDois.length).toBeGreaterThan(0);
  });
});

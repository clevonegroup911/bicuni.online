/**
 * E2E logique (Vitest) — parcours OaaS sans UI.
 * Marquage TEST : mocks uniquement, aucune donnée institutionnelle réelle.
 */
import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/oaas/state-machine";
import { AGENT_REGISTRY, AGENT_HARD_PROHIBITIONS } from "@/lib/oaas/agents";
import { OUTCOME_PACK_CATALOG } from "@/lib/oaas/catalog";
import { buildAcademicResearchGraph } from "@/lib/oaas/packs/academic-research";

describe("OaaS end-to-end contract (logic)", () => {
  it("expose le pack recherche académique vérifiée", () => {
    expect(OUTCOME_PACK_CATALOG.some((p) => p.slug === "academic-research")).toBe(true);
  });

  it("enregistre les 17 agents initiaux", () => {
    expect(AGENT_REGISTRY).toHaveLength(17);
    expect(AGENT_HARD_PROHIBITIONS).toContain("fabricate_reference");
  });

  it("enchaîne Demande → … → Acceptation au niveau des états", () => {
    const flow = [
      "DRAFT",
      "QUALIFIED",
      "QUOTED",
      "AWAITING_APPROVAL",
      "AWAITING_PAYMENT",
      "PLANNED",
      "READY",
      "EXECUTING",
      "AWAITING_HUMAN_REVIEW",
      "EXECUTING",
      "VERIFYING",
      "DELIVERY_READY",
      "DELIVERED",
      "ACCEPTED",
      "COMPLETED",
    ] as const;
    for (let i = 0; i < flow.length - 1; i += 1) {
      expect(canTransition(flow[i], flow[i + 1])).toBe(true);
    }
  });

  it("planifie le graphe recherche avec human gate", () => {
    const graph = buildAcademicResearchGraph();
    expect(graph.map((t) => t.key)).toContain("human-source-review");
    expect(graph.map((t) => t.key)).toContain("delivery");
  });
});

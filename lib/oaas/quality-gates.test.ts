import { describe, expect, it } from "vitest";
import { finalizeDeliveryGateSpec } from "@/lib/oaas/quality-gates";

describe("quality gates delivery", () => {
  it("bloque la livraison sans preuves", () => {
    const checks = finalizeDeliveryGateSpec({
      contractAccepted: true,
      evidences: [],
      inventedEvidence: false,
      sourcesCount: 1,
      deliverablesReady: true,
      tasksComplete: true,
      approvalsResolved: true,
    });
    expect(checks.some((c) => c.key === "evidences-present" && !c.pass)).toBe(true);
  });

  it("bloque sans contrat accepté", () => {
    const checks = finalizeDeliveryGateSpec({
      contractAccepted: false,
      evidences: [{}],
      inventedEvidence: false,
      sourcesCount: 1,
      deliverablesReady: true,
      tasksComplete: true,
      approvalsResolved: true,
    });
    expect(checks.some((c) => c.key === "contract-accepted" && !c.pass)).toBe(true);
  });

  it("passe lorsque tous les critères P0 sont satisfaits", () => {
    const checks = finalizeDeliveryGateSpec({
      contractAccepted: true,
      evidences: [{}],
      inventedEvidence: false,
      sourcesCount: 1,
      deliverablesReady: true,
      tasksComplete: true,
      approvalsResolved: true,
    });
    expect(checks.every((c) => c.pass)).toBe(true);
  });
});

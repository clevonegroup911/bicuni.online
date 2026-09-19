import { describe, expect, it } from "vitest";
import {
  AGENT_REGISTRY,
  agentAvailableFlag,
  assertAgentCanExecute,
  formatAgentAvailabilityLine,
  formatExecutorKindLabel,
  isAgentExecutable,
  STRIPE_OAAS_STATUS,
} from "@/lib/oaas/agents";
import {
  assertTransition,
  canEnterExecution,
  canTransition,
  OUTCOME_TRANSITIONS,
} from "@/lib/oaas/state-machine";

describe("outcome state machine — couverture étendue", () => {
  it("interdit DRAFT → COMPLETED", () => {
    expect(canTransition("DRAFT", "COMPLETED")).toBe(false);
    expect(() => assertTransition("DRAFT", "COMPLETED")).toThrow(/Transition interdite/);
  });

  it("interdit AWAITING_PAYMENT → EXECUTING", () => {
    expect(canTransition("AWAITING_PAYMENT", "EXECUTING")).toBe(false);
  });

  it("interdit EXECUTING → ACCEPTED", () => {
    expect(canTransition("EXECUTING", "ACCEPTED")).toBe(false);
  });

  it("interdit DELIVERED → COMPLETED sans acceptation", () => {
    expect(canTransition("DELIVERED", "COMPLETED")).toBe(false);
    expect(canTransition("DELIVERED", "ACCEPTED")).toBe(true);
    expect(canTransition("ACCEPTED", "COMPLETED")).toBe(true);
  });

  it("autorise le parcours nominal", () => {
    const path = [
      ["DRAFT", "QUALIFIED"],
      ["QUALIFIED", "QUOTED"],
      ["QUOTED", "AWAITING_APPROVAL"],
      ["AWAITING_APPROVAL", "AWAITING_PAYMENT"],
      ["AWAITING_PAYMENT", "PLANNED"],
      ["PLANNED", "READY"],
      ["READY", "EXECUTING"],
      ["EXECUTING", "VERIFYING"],
      ["VERIFYING", "DELIVERY_READY"],
      ["DELIVERY_READY", "DELIVERED"],
      ["DELIVERED", "ACCEPTED"],
      ["ACCEPTED", "COMPLETED"],
    ] as const;
    for (const [from, to] of path) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it("refuse l’exécution sans paiement confirmé", () => {
    expect(canEnterExecution("READY", false)).toBe(false);
    expect(canEnterExecution("READY", true)).toBe(true);
  });

  it("autorise annulation depuis AWAITING_PAYMENT", () => {
    expect(canTransition("AWAITING_PAYMENT", "CANCELLED")).toBe(true);
  });

  it("autorise révision puis reprise ou nouveau paiement", () => {
    expect(canTransition("DELIVERED", "REVISION_REQUESTED")).toBe(true);
    expect(canTransition("REVISION_REQUESTED", "EXECUTING")).toBe(true);
    expect(canTransition("REVISION_REQUESTED", "AWAITING_PAYMENT")).toBe(true);
  });

  it("aucune transition depuis COMPLETED / CANCELLED / EXPIRED", () => {
    expect(OUTCOME_TRANSITIONS.COMPLETED).toEqual([]);
    expect(OUTCOME_TRANSITIONS.CANCELLED).toEqual([]);
    expect(OUTCOME_TRANSITIONS.EXPIRED).toEqual([]);
  });
});

describe("agent executor honesty", () => {
  it("enregistre exactement 17 agents", () => {
    expect(AGENT_REGISTRY).toHaveLength(17);
  });

  it("n’expose available que pour DETERMINISTIC_LOCAL / REAL_EXECUTOR", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(agentAvailableFlag(agent)).toBe(isAgentExecutable(agent));
      if (agent.executorKind === "ADAPTER_NOT_CONFIGURED" || agent.executorKind === "DISABLED" || agent.executorKind === "STUB_FORBIDDEN") {
        expect(agentAvailableFlag(agent)).toBe(false);
      }
    }
  });

  it("refuse d’exécuter un adaptateur non configuré", () => {
    expect(() => assertAgentCanExecute("ocr")).toThrow(/ADAPTER_NOT_CONFIGURED|non exécutable/);
  });

  it("autorise la tranche académique déterministe", () => {
    expect(assertAgentCanExecute("research-intake").executorKind).toBe("DETERMINISTIC_LOCAL");
  });

  it("déclare Stripe OaaS non configuré", () => {
    expect(STRIPE_OAAS_STATUS).toBe("ADAPTER_NOT_CONFIGURED");
  });

  it("expose des libellés d’exécuteur honnêtes pour l’UI", () => {
    expect(formatExecutorKindLabel("DETERMINISTIC_LOCAL")).toBe("Exécuteur local déterministe");
    expect(formatExecutorKindLabel("ADAPTER_NOT_CONFIGURED")).toBe("Adaptateur non configuré");
    expect(formatExecutorKindLabel("DISABLED")).toBe("Fonction désactivée");
    expect(formatExecutorKindLabel("REAL_EXECUTOR")).toBe("Exécuteur externe réel");
    expect(formatAgentAvailabilityLine("research-intake")).toContain("Exécuteur local déterministe");
    expect(formatAgentAvailabilityLine("research-intake")).toContain("disponible=oui");
    expect(formatAgentAvailabilityLine("ocr")).toContain("Adaptateur non configuré");
    expect(formatAgentAvailabilityLine("ocr")).toContain("disponible=non");
    expect(formatAgentAvailabilityLine("metadata")).toContain("Fonction désactivée");
    expect(formatAgentAvailabilityLine("metadata")).toContain("disponible=non");
    expect(formatExecutorKindLabel("REAL_EXECUTOR")).toBe("Exécuteur externe réel");
  });
});

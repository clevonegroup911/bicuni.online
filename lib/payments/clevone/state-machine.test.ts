import { describe, expect, it } from "vitest";
import { assertTransition, canActivate, canTransition } from "./state-machine";

describe("machine à états CLEVONE", () => {
  it("interdit PROOF_SUBMITTED → PAID", () => {
    expect(canTransition("PROOF_SUBMITTED", "PAID")).toBe(false);
    expect(() => assertTransition("PROOF_SUBMITTED", "PAID")).toThrow(/interdite/);
  });

  it("n’autorise l’activation que depuis PAID", () => {
    expect(canActivate("PAID")).toBe(true);
    expect(canActivate("PROOF_SUBMITTED")).toBe(false);
    expect(canActivate("REVIEW_REQUIRED")).toBe(false);
  });

  it("exige le double contrôle via REVIEW_REQUIRED → PAID", () => {
    expect(canTransition("REVIEW_REQUIRED", "PAID")).toBe(true);
    expect(canTransition("MATCHING", "PAID")).toBe(false);
    expect(canTransition("PENDING", "PAID")).toBe(false);
  });
});

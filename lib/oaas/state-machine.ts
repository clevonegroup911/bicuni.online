import type { OutcomeMissionStatus } from "@prisma/client";

/** Transitions autorisées pour OutcomeMission. Toute autre transition est refusée. */
export const OUTCOME_TRANSITIONS: Readonly<Record<OutcomeMissionStatus, readonly OutcomeMissionStatus[]>> = {
  DRAFT: ["QUALIFICATION_REQUIRED", "QUALIFIED", "CANCELLED"],
  QUALIFICATION_REQUIRED: ["QUALIFIED", "BLOCKED", "CANCELLED"],
  QUALIFIED: ["QUOTED", "CANCELLED"],
  QUOTED: ["AWAITING_APPROVAL", "CANCELLED"],
  AWAITING_APPROVAL: ["AWAITING_PAYMENT", "QUOTED", "CANCELLED"],
  AWAITING_PAYMENT: ["PLANNED", "EXPIRED", "CANCELLED"],
  PLANNED: ["READY", "BLOCKED", "CANCELLED"],
  READY: ["EXECUTING", "BLOCKED", "CANCELLED"],
  EXECUTING: ["AWAITING_HUMAN_REVIEW", "VERIFYING", "BLOCKED", "FAILED"],
  AWAITING_HUMAN_REVIEW: ["EXECUTING", "VERIFYING", "BLOCKED", "FAILED"],
  VERIFYING: ["DELIVERY_READY", "EXECUTING", "FAILED", "BLOCKED"],
  DELIVERY_READY: ["DELIVERED", "BLOCKED"],
  DELIVERED: ["ACCEPTED", "REVISION_REQUESTED", "EXPIRED"],
  ACCEPTED: ["COMPLETED"],
  REVISION_REQUESTED: ["EXECUTING", "AWAITING_PAYMENT", "CANCELLED"],
  COMPLETED: [],
  BLOCKED: ["QUALIFICATION_REQUIRED", "PLANNED", "READY", "EXECUTING", "CANCELLED", "FAILED"],
  FAILED: ["CANCELLED"],
  CANCELLED: [],
  EXPIRED: [],
};

export class OutcomeTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutcomeTransitionError";
  }
}

export function canTransition(from: OutcomeMissionStatus, to: OutcomeMissionStatus): boolean {
  return OUTCOME_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OutcomeMissionStatus, to: OutcomeMissionStatus): void {
  if (!canTransition(from, to)) {
    throw new OutcomeTransitionError(`Transition interdite : ${from} → ${to}.`);
  }
}

/** Paiement confirmé requis avant exécution, sauf règle commerciale explicite. */
export function canEnterExecution(status: OutcomeMissionStatus, paymentConfirmed: boolean): boolean {
  if (status === "READY" || status === "PLANNED") return paymentConfirmed;
  if (status === "EXECUTING") return paymentConfirmed;
  return false;
}

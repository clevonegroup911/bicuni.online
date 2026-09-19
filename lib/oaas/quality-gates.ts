/** Spécification pure des contrôles Quality Gate (testable sans DB). */

export type DeliveryGateInput = {
  contractAccepted: boolean;
  evidences: unknown[];
  inventedEvidence: boolean;
  sourcesCount: number;
  deliverablesReady: boolean;
  tasksComplete: boolean;
  approvalsResolved: boolean;
};

export function finalizeDeliveryGateSpec(input: DeliveryGateInput) {
  return [
    {
      key: "contract-accepted",
      severity: "P0" as const,
      pass: input.contractAccepted,
    },
    {
      key: "no-invented-evidence",
      severity: "P0" as const,
      pass: !input.inventedEvidence,
    },
    {
      key: "evidences-present",
      severity: "P0" as const,
      pass: input.evidences.length > 0,
    },
    {
      key: "sources-declared",
      severity: "P1" as const,
      pass: input.sourcesCount > 0 || input.evidences.length > 0,
    },
    {
      key: "deliverables-ready",
      severity: "P0" as const,
      pass: input.deliverablesReady,
    },
    {
      key: "tasks-complete",
      severity: "P0" as const,
      pass: input.tasksComplete,
    },
    {
      key: "approvals-resolved",
      severity: "P0" as const,
      pass: input.approvalsResolved,
    },
  ];
}

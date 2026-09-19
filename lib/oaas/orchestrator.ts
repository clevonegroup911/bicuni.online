import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  AGENT_REGISTRY,
  assertAgentCanExecute,
  agentAvailableFlag,
} from "@/lib/oaas/agents";
import { OutcomeServiceError } from "@/lib/oaas/mission-service";
import { assertTransition, canEnterExecution } from "@/lib/oaas/state-machine";
import { buildAcademicResearchGraph, runAcademicResearchTask } from "@/lib/oaas/packs/academic-research";
import type { PlanTaskSpec } from "@/lib/oaas/types";

export type { PlanTaskSpec };

const SUPPORTED_EXECUTION_PACKS = new Set(["academic-research", "verified-bibliography"]);

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function inputFingerprint(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function ensureAgents(db: PrismaClient) {
  for (const agent of AGENT_REGISTRY) {
    const available = agentAvailableFlag(agent);
    await db.outcomeAgent.upsert({
      where: { key: agent.key },
      update: {
        name: agent.name,
        specialty: agent.specialty,
        version: agent.version,
        tools: agent.tools,
        permissions: agent.permissions,
        allowedSources: agent.allowedSources,
        costPerTaskCents: agent.costPerTaskCents,
        available,
        confidenceLevel: agent.confidenceLevel,
      },
      create: {
        key: agent.key,
        name: agent.name,
        specialty: agent.specialty,
        version: agent.version,
        tools: agent.tools,
        permissions: agent.permissions,
        allowedSources: agent.allowedSources,
        costPerTaskCents: agent.costPerTaskCents,
        confidenceLevel: agent.confidenceLevel,
        available,
      },
    });
  }
}

export async function buildExecutionPlan(db: PrismaClient, missionId: string, actorId: string) {
  const mission = await db.outcomeMission.findUnique({
    where: { id: missionId },
    include: { pack: true, sources: true, plan: true, tasks: true },
  });
  if (!mission) throw new OutcomeServiceError("Mission introuvable.", 404);
  if (mission.ownerId !== actorId) throw new OutcomeServiceError("Accès refusé.", 403, "FORBIDDEN");
  if (mission.status !== "PLANNED" && mission.status !== "READY") {
    throw new OutcomeServiceError(`Planification impossible depuis ${mission.status}. Paiement requis avant exécution.`, 409, "CONFLICT");
  }

  if (!mission.paidAt) {
    throw new OutcomeServiceError("Paiement confirmé requis avant planification.", 409, "PAYMENT_REQUIRED");
  }

  await ensureAgents(db);

  const packSlug = mission.pack?.slug ?? "custom-mission";
  if (!SUPPORTED_EXECUTION_PACKS.has(packSlug)) {
    throw new OutcomeServiceError(
      `Pack « ${packSlug} » sans exécuteur opérationnel (DISABLED / ADAPTER_NOT_CONFIGURED). Aucun faux plan ne sera généré.`,
      422,
      "ADAPTER_NOT_CONFIGURED",
    );
  }
  const graph: PlanTaskSpec[] = buildAcademicResearchGraph();

  await db.$transaction(async (tx) => {
    await tx.outcomeTask.deleteMany({ where: { missionId: mission.id } });
    await tx.outcomeAgentAssignment.deleteMany({ where: { missionId: mission.id } });

    for (const spec of graph) {
      const agent = await tx.outcomeAgent.findUnique({ where: { key: spec.agentKey } });
      if (!agent) throw new OutcomeServiceError(`Agent manquant : ${spec.agentKey}`, 500, "INTERNAL");
      const task = await tx.outcomeTask.create({
        data: {
          missionId: mission.id,
          key: spec.key,
          title: spec.title,
          description: spec.description,
          dependsOn: spec.dependsOn,
          agentKey: spec.agentKey,
          parallelGroup: spec.parallelGroup,
          requiresHuman: Boolean(spec.requiresHuman),
          status: spec.dependsOn.length === 0 ? "READY" : "PENDING",
          costCents: agent.costPerTaskCents,
        },
      });
      await tx.outcomeAgentAssignment.create({
        data: { missionId: mission.id, taskId: task.id, agentId: agent.id, role: "executor" },
      });
    }

    await tx.outcomePlan.upsert({
      where: { missionId: mission.id },
      update: {
        version: { increment: 1 },
        graph: { tasks: graph },
        checkpoint: { completedKeys: [] },
        estimatedMinutes: graph.length * 8,
      },
      create: {
        missionId: mission.id,
        graph: { tasks: graph },
        checkpoint: { completedKeys: [] },
        estimatedMinutes: graph.length * 8,
      },
    });

    if (mission.status === "PLANNED") {
      assertTransition("PLANNED", "READY");
      await tx.outcomeMission.updateMany({
        where: { id: mission.id, status: "PLANNED" },
        data: { status: "READY", nextStep: "Lancer l’exécution agentique" },
      });
      await tx.outcomeStatusTransition.create({
        data: {
          missionId: mission.id,
          fromStatus: "PLANNED",
          toStatus: "READY",
          actorId,
          reason: "Plan d’exécution prêt",
        },
      });
    }
  });

  return db.outcomeMission.findUniqueOrThrow({
    where: { id: missionId },
    include: { plan: true, tasks: true, agentAssignments: { include: { agent: true } } },
  });
}

function depsSatisfied(dependsOn: string[], completed: Set<string>) {
  return dependsOn.every((key) => completed.has(key));
}

export async function executeMissionStep(db: PrismaClient, missionId: string, actorId: string) {
  const mission = await db.outcomeMission.findUnique({
    where: { id: missionId },
    include: {
      pack: true,
      sources: true,
      plan: true,
      tasks: true,
      approvals: true,
      contract: true,
    },
  });
  if (!mission) throw new OutcomeServiceError("Mission introuvable.", 404);
  if (mission.ownerId !== actorId) throw new OutcomeServiceError("Accès refusé.", 403, "FORBIDDEN");
  if (!mission.contract || mission.contract.status !== "ACCEPTED") {
    throw new OutcomeServiceError("Contrat de résultat accepté requis avant exécution.", 409, "NO_CONTRACT");
  }
  if (!mission.paidAt || !canEnterExecution(mission.status === "AWAITING_HUMAN_REVIEW" ? "EXECUTING" : mission.status, true)) {
    if (!mission.paidAt) {
      throw new OutcomeServiceError("Paiement confirmé requis avant exécution.", 409, "PAYMENT_REQUIRED");
    }
  }

  if (mission.status === "READY") {
    // Double démarrage : updateMany conditionnel (idempotent si déjà EXECUTING).
    assertTransition("READY", "EXECUTING");
    const started = await db.outcomeMission.updateMany({
      where: { id: mission.id, status: "READY" },
      data: { status: "EXECUTING", startedAt: new Date(), nextStep: "Exécution des tâches" },
    });
    if (started.count === 1) {
      await db.outcomeStatusTransition.create({
        data: {
          missionId: mission.id,
          fromStatus: "READY",
          toStatus: "EXECUTING",
          actorId,
          reason: "Démarrage orchestrateur",
        },
      });
    }
  } else if (mission.status === "AWAITING_HUMAN_REVIEW") {
    const pending = mission.approvals.filter((a) => a.status === "PENDING");
    if (pending.length) {
      throw new OutcomeServiceError("Une validation humaine est encore en attente.", 409, "CONFLICT");
    }
    assertTransition("AWAITING_HUMAN_REVIEW", "EXECUTING");
    await db.outcomeMission.updateMany({
      where: { id: mission.id, status: "AWAITING_HUMAN_REVIEW" },
      data: { status: "EXECUTING", nextStep: "Reprise après revue humaine" },
    });
    await db.outcomeStatusTransition.create({
      data: {
        missionId: mission.id,
        fromStatus: "AWAITING_HUMAN_REVIEW",
        toStatus: "EXECUTING",
        actorId,
        reason: "Reprise après validation",
      },
    });
  } else if (mission.status !== "EXECUTING") {
    throw new OutcomeServiceError(`Exécution impossible depuis ${mission.status}.`, 409, "CONFLICT");
  }

  const fresh = await db.outcomeMission.findUniqueOrThrow({
    where: { id: missionId },
    include: { pack: true, sources: true, plan: true, tasks: true, contract: true },
  });

  const completed = new Set(fresh.tasks.filter((t) => t.status === "COMPLETED" || t.status === "SKIPPED").map((t) => t.key));
  for (const task of fresh.tasks.filter((t) => t.status === "PENDING")) {
    if (depsSatisfied(task.dependsOn, completed)) {
      await db.outcomeTask.update({ where: { id: task.id }, data: { status: "READY" } });
    }
  }

  const readyTasks = (await db.outcomeTask.findMany({ where: { missionId, status: "READY" } })).filter((t) =>
    depsSatisfied(t.dependsOn, completed),
  );

  if (!readyTasks.length) {
    const remaining = await db.outcomeTask.count({
      where: { missionId, status: { in: ["PENDING", "READY", "RUNNING", "AWAITING_HUMAN", "BLOCKED"] } },
    });
    if (remaining === 0) {
      return finalizeDelivery(db, missionId, actorId);
    }
    throw new OutcomeServiceError("Aucune tâche prête ; graphe bloqué.", 409, "CONFLICT");
  }

  // Exécute un groupe parallèle à la fois (même parallelGroup) ou une seule tâche.
  const group = readyTasks[0].parallelGroup;
  const batch = group ? readyTasks.filter((t) => t.parallelGroup === group) : [readyTasks[0]];

  for (const task of batch) {
    if (task.requiresHuman) {
      await db.outcomeTask.update({
        where: { id: task.id },
        data: { status: "AWAITING_HUMAN", startedAt: new Date() },
      });
      await db.outcomeApproval.create({
        data: {
          missionId,
          kind: "TASK_REVIEW",
          title: `Validation requise : ${task.title}`,
          status: "PENDING",
        },
      });
      assertTransition("EXECUTING", "AWAITING_HUMAN_REVIEW");
      await db.outcomeMission.updateMany({
        where: { id: missionId, status: "EXECUTING" },
        data: { status: "AWAITING_HUMAN_REVIEW", nextStep: `Valider : ${task.title}` },
      });
      await db.outcomeStatusTransition.create({
        data: {
          missionId,
          fromStatus: "EXECUTING",
          toStatus: "AWAITING_HUMAN_REVIEW",
          actorId,
          reason: task.key,
        },
      });
      return { pausedForHuman: true as const, taskKey: task.key };
    }

    let agentDef;
    try {
      agentDef = assertAgentCanExecute(task.agentKey ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent non exécutable";
      await db.outcomeTask.update({
        where: { id: task.id },
        data: { status: "FAILED", errorMessage: message, completedAt: new Date() },
      });
      throw new OutcomeServiceError(message, 422, "ADAPTER_NOT_CONFIGURED");
    }

    const startedAt = new Date();
    await db.outcomeTask.update({
      where: { id: task.id },
      data: { status: "RUNNING", startedAt },
    });

    const missionInput = {
      title: fresh.title,
      originalRequest: fresh.originalRequest,
      expectedOutcome: fresh.expectedOutcome,
      academicDomain: fresh.academicDomain,
      academicLevel: fresh.academicLevel,
      language: fresh.language,
      scope: fresh.scope,
      exclusions: fresh.exclusions,
      sources: fresh.sources.map((s) => ({
        label: s.label,
        uri: s.uri,
        accessible: s.accessible,
        notes: s.notes,
      })),
    };
    const inputHash = inputFingerprint({ taskKey: task.key, mission: missionInput });

    const agentRow = await db.outcomeAgent.findUnique({ where: { key: agentDef.key } });
    if (agentRow) {
      await db.outcomeAgent.update({ where: { id: agentRow.id }, data: { lastActiveAt: startedAt } });
      await db.outcomeAgentJournal.create({
        data: {
          agentId: agentRow.id,
          missionId,
          actorId,
          event: "task_started",
          detail: {
            missionId,
            agentKey: agentDef.key,
            executorKind: agentDef.executorKind,
            version: agentDef.version,
            taskKey: task.key,
            tools: agentDef.tools,
            inputFingerprint: inputHash,
            startedAt: startedAt.toISOString(),
            costMeasured: agentDef.costPerTaskCents === 0 ? "INCONNU" : agentDef.costPerTaskCents,
            confidence: agentDef.confidenceLevel.toUpperCase(),
          },
        },
      });
    }

    try {
      const result = await runAcademicResearchTask({
        taskKey: task.key,
        mission: missionInput,
      });

      if (result.inventedContent) {
        throw new Error("Violation d’intégrité : contenu inventé détecté.");
      }

      const completedAt = new Date();
      const outputRef = inputFingerprint(result.payload);
      await db.outcomeTask.update({
        where: { id: task.id },
        data: {
          status: "COMPLETED",
          completedAt,
          result: asJson({
            ...result.payload,
            _meta: {
              executorKind: agentDef.executorKind,
              version: agentDef.version,
              inputFingerprint: inputHash,
              outputRef,
              costMeasured: "INCONNU",
              confidence: agentDef.confidenceLevel.toUpperCase(),
            },
          }),
        },
      });

      for (const evidence of result.evidences) {
        await db.outcomeEvidence.create({
          data: {
            missionId,
            kind: evidence.kind,
            title: evidence.title,
            summary: evidence.summary,
            payload: asJson(evidence.payload),
            invented: false,
            checksum: createHash("sha256").update(JSON.stringify(evidence.payload)).digest("hex"),
          },
        });
      }

      for (const deliverable of result.deliverables) {
        await db.outcomeDeliverable.upsert({
          where: { missionId_key: { missionId, key: deliverable.key } },
          update: {
            title: deliverable.title,
            format: deliverable.format,
            content: asJson(deliverable.content),
            status: "READY",
            checksum: createHash("sha256").update(JSON.stringify(deliverable.content)).digest("hex"),
          },
          create: {
            missionId,
            key: deliverable.key,
            title: deliverable.title,
            format: deliverable.format,
            content: asJson(deliverable.content),
            status: "READY",
            checksum: createHash("sha256").update(JSON.stringify(deliverable.content)).digest("hex"),
          },
        });
      }

      if (agentRow) {
        await db.outcomeAgentJournal.create({
          data: {
            agentId: agentRow.id,
            missionId,
            actorId,
            event: "task_completed",
            detail: {
              missionId,
              agentKey: agentDef.key,
              executorKind: agentDef.executorKind,
              version: agentDef.version,
              taskKey: task.key,
              tools: agentDef.tools,
              inputFingerprint: inputHash,
              outputRef,
              startedAt: startedAt.toISOString(),
              completedAt: completedAt.toISOString(),
              status: "COMPLETED",
              evidences: result.evidences.map((e) => e.title),
              costMeasured: "INCONNU",
              confidence: agentDef.confidenceLevel.toUpperCase(),
              errors: null,
            },
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Échec tâche";
      const failedAt = new Date();
      await db.outcomeTask.update({
        where: { id: task.id },
        data: { status: "FAILED", errorMessage: message, completedAt: failedAt },
      });
      if (agentRow) {
        await db.outcomeAgentJournal.create({
          data: {
            agentId: agentRow.id,
            missionId,
            actorId,
            event: "task_failed",
            detail: {
              missionId,
              agentKey: agentDef.key,
              executorKind: agentDef.executorKind,
              version: agentDef.version,
              taskKey: task.key,
              inputFingerprint: inputHash,
              startedAt: startedAt.toISOString(),
              completedAt: failedAt.toISOString(),
              status: "FAILED",
              errors: [message],
              costMeasured: "INCONNU",
              confidence: "INCONNUE",
            },
          },
        });
      }
      assertTransition("EXECUTING", "FAILED");
      await db.outcomeMission.updateMany({
        where: { id: missionId, status: "EXECUTING" },
        data: { status: "FAILED", blockedReason: message, nextStep: null },
      });
      await db.outcomeStatusTransition.create({
        data: {
          missionId,
          fromStatus: "EXECUTING",
          toStatus: "FAILED",
          actorId,
          reason: message,
        },
      });
      throw new OutcomeServiceError(message, 500, "FAILED");
    }
  }

  const checkpointKeys = (
    await db.outcomeTask.findMany({
      where: { missionId, status: "COMPLETED" },
      select: { key: true },
    })
  ).map((t) => t.key);

  await db.outcomePlan.update({
    where: { missionId },
    data: { checkpoint: { completedKeys: checkpointKeys, at: new Date().toISOString() } },
  });

  const remaining = await db.outcomeTask.count({
    where: { missionId, status: { notIn: ["COMPLETED", "SKIPPED"] } },
  });
  if (remaining === 0) {
    return finalizeDelivery(db, missionId, actorId);
  }

  return { pausedForHuman: false as const, remaining };
}

async function finalizeDelivery(db: PrismaClient, missionId: string, actorId: string) {
  const mission = await db.outcomeMission.findUniqueOrThrow({
    where: { id: missionId },
    include: {
      deliverables: true,
      evidences: true,
      sources: true,
      tasks: true,
      contract: true,
      approvals: true,
      qualityChecks: true,
    },
  });

  // Idempotence : déjà livré
  if (mission.status === "DELIVERED" || mission.status === "COMPLETED" || mission.status === "ACCEPTED") {
    return { delivered: true as const, reason: "already" as const };
  }

  const pendingApprovals = mission.approvals.filter((a) => a.status === "PENDING");
  const rejectedApprovals = mission.approvals.filter((a) => a.status === "REJECTED");
  const requiredHumanTasks = mission.tasks.filter((t) => t.requiresHuman);
  const humanTasksDone = requiredHumanTasks.every(
    (t) => t.status === "COMPLETED" || t.status === "SKIPPED",
  );

  // Quality Gate — P0/P1 bloquants
  const checks = [
    {
      key: "contract-accepted",
      title: "Contrat de résultat accepté",
      severity: "P0" as const,
      pass: Boolean(mission.contract && mission.contract.status === "ACCEPTED"),
    },
    {
      key: "no-invented-evidence",
      title: "Aucune preuve inventée",
      severity: "P0" as const,
      pass: mission.evidences.every((e) => !e.invented),
    },
    {
      key: "evidences-present",
      title: "Preuves rattachées",
      severity: "P0" as const,
      pass: mission.evidences.length > 0,
    },
    {
      key: "sources-declared",
      title: "Sources déclarées ou absence justifiée",
      severity: "P1" as const,
      pass: mission.sources.length > 0 || mission.evidences.some((e) => e.kind === "SOURCE"),
    },
    {
      key: "deliverables-ready",
      title: "Livrables prêts",
      severity: "P0" as const,
      pass: mission.deliverables.length > 0 && mission.deliverables.some((d) => d.status === "READY" || d.status === "DELIVERED"),
    },
    {
      key: "tasks-complete",
      title: "Tâches obligatoires terminées",
      severity: "P0" as const,
      pass: mission.tasks.every((t) => t.status === "COMPLETED" || t.status === "SKIPPED"),
    },
    {
      key: "approvals-resolved",
      title: "Approbations requises résolues",
      severity: "P0" as const,
      pass: pendingApprovals.length === 0 && rejectedApprovals.length === 0 && humanTasksDone,
    },
  ];

  for (const check of checks) {
    await db.outcomeQualityCheck.upsert({
      where: { missionId_key: { missionId, key: check.key } },
      update: {
        verdict: check.pass ? "PASS" : "FAIL",
        checkedAt: new Date(),
        details: { pass: check.pass, severity: check.severity },
      },
      create: {
        missionId,
        key: check.key,
        title: check.title,
        verdict: check.pass ? "PASS" : "FAIL",
        checkedAt: new Date(),
        details: { pass: check.pass, severity: check.severity },
      },
    });
  }

  const failed = checks.filter((c) => !c.pass);
  if (mission.status === "EXECUTING") {
    assertTransition("EXECUTING", "VERIFYING");
    await db.outcomeMission.updateMany({
      where: { id: missionId, status: "EXECUTING" },
      data: { status: "VERIFYING", nextStep: "Quality Gate" },
    });
    await db.outcomeStatusTransition.create({
      data: { missionId, fromStatus: "EXECUTING", toStatus: "VERIFYING", actorId, reason: "Quality Gate" },
    });
  }

  if (failed.length) {
    assertTransition("VERIFYING", "FAILED");
    await db.outcomeMission.updateMany({
      where: { id: missionId, status: "VERIFYING" },
      data: {
        status: "FAILED",
        blockedReason: `Quality Gate échoué : ${failed.map((f) => f.key).join(", ")}`,
        nextStep: null,
      },
    });
    await db.outcomeStatusTransition.create({
      data: {
        missionId,
        fromStatus: "VERIFYING",
        toStatus: "FAILED",
        actorId,
        reason: `Quality Gate échoué : ${failed.map((f) => f.key).join(", ")}`,
      },
    });
    throw new OutcomeServiceError("Quality Gate échoué — livraison bloquée.", 422, "QUALITY");
  }

  await db.outcomeEvidence.create({
    data: {
      missionId,
      kind: "QUALITY_GATE",
      title: "Quality Gate réussi",
      summary: "Contrôles d’intégrité et de complétude validés",
      payload: { checks: checks.map((c) => ({ key: c.key, severity: c.severity, pass: true })) },
      invented: false,
    },
  });

  assertTransition("VERIFYING", "DELIVERY_READY");
  const ready = await db.outcomeMission.updateMany({
    where: { id: missionId, status: "VERIFYING" },
    data: { status: "DELIVERY_READY", nextStep: "Livrer au client" },
  });
  if (ready.count === 1) {
    await db.outcomeStatusTransition.create({
      data: { missionId, fromStatus: "VERIFYING", toStatus: "DELIVERY_READY", actorId, reason: "QG OK" },
    });
  }

  assertTransition("DELIVERY_READY", "DELIVERED");
  const now = new Date();
  await db.outcomeDeliverable.updateMany({
    where: { missionId, status: "READY" },
    data: { status: "DELIVERED", deliveredAt: now },
  });
  const delivered = await db.outcomeMission.updateMany({
    where: { id: missionId, status: "DELIVERY_READY" },
    data: { status: "DELIVERED", deliveredAt: now, nextStep: "Accepter ou demander une correction" },
  });
  if (delivered.count === 1) {
    await db.outcomeStatusTransition.create({
      data: { missionId, fromStatus: "DELIVERY_READY", toStatus: "DELIVERED", actorId, reason: "Livraison" },
    });
  }

  return { delivered: true as const };
}

export async function decideApproval(
  db: PrismaClient,
  input: { approvalId: string; actorId: string; decision: "APPROVED" | "REJECTED"; reason?: string },
) {
  const approval = await db.outcomeApproval.findUnique({
    where: { id: input.approvalId },
    include: { mission: true },
  });
  if (!approval) throw new OutcomeServiceError("Approbation introuvable.", 404);
  if (approval.mission.ownerId !== input.actorId) throw new OutcomeServiceError("Accès refusé.", 403, "FORBIDDEN");
  if (approval.status !== "PENDING") throw new OutcomeServiceError("Approbation déjà tranchée.", 409, "CONFLICT");

  await db.outcomeApproval.update({
    where: { id: approval.id },
    data: {
      status: input.decision,
      actorId: input.actorId,
      reason: input.reason,
      decidedAt: new Date(),
    },
  });

  if (input.decision === "REJECTED") {
    const from = approval.mission.status;
    if (from === "AWAITING_HUMAN_REVIEW" || from === "EXECUTING") {
      assertTransition(from, "BLOCKED");
      await db.outcomeMission.updateMany({
        where: { id: approval.missionId, status: from },
        data: { status: "BLOCKED", blockedReason: input.reason ?? "Approbation refusée" },
      });
      await db.outcomeStatusTransition.create({
        data: {
          missionId: approval.missionId,
          fromStatus: from,
          toStatus: "BLOCKED",
          actorId: input.actorId,
          reason: input.reason ?? "Approbation refusée",
        },
      });
    }
  }

  await db.outcomeEvidence.create({
    data: {
      missionId: approval.missionId,
      kind: "HUMAN_REVIEW",
      title: `Revue humaine : ${approval.title}`,
      summary: input.decision,
      payload: { approvalId: approval.id, decision: input.decision, reason: input.reason ?? null },
      invented: false,
    },
  });

  const awaiting = await db.outcomeTask.findFirst({
    where: { missionId: approval.missionId, status: "AWAITING_HUMAN" },
  });
  if (awaiting && input.decision === "APPROVED") {
    await db.outcomeTask.update({
      where: { id: awaiting.id },
      data: { status: "COMPLETED", completedAt: new Date(), result: { humanApproved: true } },
    });
  }

  return { status: input.decision };
}

/** Exécute jusqu’à pause humaine (approbation PENDING) ou livraison (utile tests / reprise). */
export async function runOrchestratorUntilPause(db: PrismaClient, missionId: string, actorId: string, maxSteps = 40) {
  for (let i = 0; i < maxSteps; i += 1) {
    const current = await db.outcomeMission.findUnique({
      where: { id: missionId },
      select: { status: true },
    });
    if (!current) throw new OutcomeServiceError("Mission introuvable.", 404);
    if (current.status === "DELIVERED" || current.status === "COMPLETED" || current.status === "FAILED") {
      return { status: current.status, steps: i };
    }
    if (current.status === "AWAITING_HUMAN_REVIEW") {
      const pending = await db.outcomeApproval.count({
        where: { missionId, status: "PENDING" },
      });
      if (pending > 0) {
        return { status: current.status, steps: i };
      }
      // Approbations résolues : reprendre l’exécution (ne pas bloquer silencieusement).
    }
    const step = await executeMissionStep(db, missionId, actorId);
    if ("delivered" in step && step.delivered) return { status: "DELIVERED" as const, steps: i + 1 };
    if ("pausedForHuman" in step && step.pausedForHuman) return { status: "AWAITING_HUMAN_REVIEW" as const, steps: i + 1 };
  }
  throw new OutcomeServiceError("Limite de pas orchestrateur atteinte.", 500, "INTERNAL");
}

import { createHash, randomBytes } from "node:crypto";
import type {
  OutcomeConfidentiality,
  OutcomeMissionStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { getOutcomePack } from "@/lib/oaas/catalog";
import { assertTransition } from "@/lib/oaas/state-machine";

export class OutcomeServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "VALIDATION",
  ) {
    super(message);
    this.name = "OutcomeServiceError";
  }
}

export function newMissionPublicRef() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `OM-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

async function transitionMission(
  db: DbClient,
  missionId: string,
  from: OutcomeMissionStatus,
  to: OutcomeMissionStatus,
  actorId: string | null,
  reason?: string,
) {
  assertTransition(from, to);
  const moved = await db.outcomeMission.updateMany({
    where: { id: missionId, status: from },
    data: { status: to },
  });
  if (moved.count !== 1) {
    throw new OutcomeServiceError(`Conflit de transition ${from} → ${to}.`, 409, "CONFLICT");
  }
  await db.outcomeStatusTransition.create({
    data: { missionId, fromStatus: from, toStatus: to, actorId: actorId ?? undefined, reason },
  });
}

export type CreateMissionInput = {
  ownerId: string;
  packSlug?: string;
  title: string;
  originalRequest: string;
  expectedOutcome: string;
  language?: string;
  academicDomain?: string;
  academicLevel?: string;
  scope?: string;
  exclusions?: string;
  deadlineAt?: Date | null;
  maxBudgetCents?: number | null;
  confidentiality?: OutcomeConfidentiality;
  acceptanceCriteria?: string[];
  universityId?: string | null;
  sources?: Array<{ label: string; uri?: string; documentId?: string; notes?: string; accessible?: boolean }>;
};

export async function createMission(db: PrismaClient, input: CreateMissionInput) {
  const pack = input.packSlug ? getOutcomePack(input.packSlug) : null;
  if (input.packSlug && !pack) throw new OutcomeServiceError("Pack OaaS inconnu.", 404);

  let packId: string | undefined;
  if (pack) {
    const row = await db.outcomePack.upsert({
      where: { slug: pack.slug },
      update: {
        title: pack.title,
        summary: pack.summary,
        resultDescription: pack.resultDescription,
        requiredInputs: pack.requiredInputs,
        indicativeDeadlineDays: pack.indicativeDeadlineDays,
        revisionsIncluded: pack.revisionsIncluded,
        acceptanceCriteria: pack.acceptanceCriteria,
        confidentialityDefault: pack.confidentialityDefault,
        pricingMode: pack.pricingMode,
        indicativePriceCents: pack.indicativePriceCents,
        planSlug: pack.planSlug,
        sortOrder: pack.sortOrder,
        active: true,
      },
      create: {
        slug: pack.slug,
        title: pack.title,
        summary: pack.summary,
        resultDescription: pack.resultDescription,
        requiredInputs: pack.requiredInputs,
        indicativeDeadlineDays: pack.indicativeDeadlineDays,
        revisionsIncluded: pack.revisionsIncluded,
        acceptanceCriteria: pack.acceptanceCriteria,
        confidentialityDefault: pack.confidentialityDefault,
        pricingMode: pack.pricingMode,
        indicativePriceCents: pack.indicativePriceCents,
        planSlug: pack.planSlug,
        sortOrder: pack.sortOrder,
      },
    });
    packId = row.id;
  }

  const criteria = input.acceptanceCriteria ?? pack?.acceptanceCriteria ?? [];
  const mission = await db.outcomeMission.create({
    data: {
      publicRef: newMissionPublicRef(),
      ownerId: input.ownerId,
      universityId: input.universityId ?? undefined,
      packId,
      title: input.title.trim(),
      originalRequest: input.originalRequest.trim(),
      expectedOutcome: input.expectedOutcome.trim(),
      language: input.language ?? "fr",
      academicDomain: input.academicDomain,
      academicLevel: input.academicLevel,
      scope: input.scope,
      exclusions: input.exclusions,
      deadlineAt: input.deadlineAt ?? undefined,
      maxBudgetCents: input.maxBudgetCents ?? undefined,
      confidentiality: input.confidentiality ?? pack?.confidentialityDefault ?? "STANDARD",
      acceptanceCriteria: criteria,
      status: "DRAFT",
      nextStep: "Qualification de la demande",
      integrityDeclaration:
        "BICUNI assiste, structure, vérifie et documente. BICUNI n’usurpe pas l’auteur, n’invente pas de sources ni de données de recherche.",
      aiAssistanceLevel: "assisted",
      sources: input.sources?.length
        ? {
            create: input.sources.map((source) => ({
              label: source.label,
              uri: source.uri,
              documentId: source.documentId,
              notes: source.notes,
              accessible: source.accessible ?? true,
            })),
          }
        : undefined,
    },
    include: { sources: true, pack: true },
  });

  await db.auditLog.create({
    data: {
      actorId: input.ownerId,
      action: "OUTCOME_MISSION_CREATED",
      entityType: "OutcomeMission",
      entityId: mission.id,
      newValue: { publicRef: mission.publicRef, packSlug: pack?.slug ?? null },
    },
  });

  return mission;
}

export async function qualifyMission(db: PrismaClient, missionId: string, actorId: string) {
  const mission = await db.outcomeMission.findUnique({ where: { id: missionId }, include: { sources: true } });
  if (!mission) throw new OutcomeServiceError("Mission introuvable.", 404);
  if (mission.ownerId !== actorId) throw new OutcomeServiceError("Accès refusé.", 403, "FORBIDDEN");

  const missing: string[] = [];
  if (!mission.expectedOutcome.trim()) missing.push("résultat attendu");
  if (!mission.originalRequest.trim()) missing.push("demande originale");
  if (missing.length) {
    await transitionMission(db, mission.id, mission.status, "QUALIFICATION_REQUIRED", actorId, `Manque : ${missing.join(", ")}`);
    await db.outcomeMission.update({
      where: { id: mission.id },
      data: { nextStep: `Compléter : ${missing.join(", ")}`, blockedReason: null },
    });
    throw new OutcomeServiceError(`Qualification incomplète : ${missing.join(", ")}.`, 422);
  }

  const from = mission.status === "DRAFT" || mission.status === "QUALIFICATION_REQUIRED" ? mission.status : null;
  if (!from) throw new OutcomeServiceError(`Qualification impossible depuis ${mission.status}.`, 409, "CONFLICT");

  await transitionMission(db, mission.id, from, "QUALIFIED", actorId, "Demande qualifiée");
  return db.outcomeMission.update({
    where: { id: mission.id },
    data: { nextStep: "Établir le devis et le contrat de résultat" },
  });
}

export async function quoteAndIssueContract(
  db: PrismaClient,
  input: {
    missionId: string;
    actorId: string;
    /** Montant client — ignoré si le pack a un prix indicatif serveur. */
    priceCents?: number;
    depositCents?: number;
    deadlineAt?: Date | null;
    revisionsIncluded?: number;
  },
) {
  const mission = await db.outcomeMission.findUnique({
    where: { id: input.missionId },
    include: { sources: true, pack: true, contract: true },
  });
  if (!mission) throw new OutcomeServiceError("Mission introuvable.", 404);
  if (mission.ownerId !== input.actorId) throw new OutcomeServiceError("Accès refusé.", 403, "FORBIDDEN");
  if (mission.status !== "QUALIFIED" && mission.status !== "QUOTED") {
    throw new OutcomeServiceError(`Devis impossible depuis ${mission.status}.`, 409, "CONFLICT");
  }

  // Prix serveur : pack FIXED / indicative prioritaire ; jamais faire confiance au client seul.
  const packPrice = mission.pack?.indicativePriceCents ?? null;
  const priceCents =
    packPrice != null && packPrice > 0
      ? packPrice
      : input.priceCents != null && Number.isInteger(input.priceCents) && input.priceCents > 0
        ? input.priceCents
        : null;
  if (priceCents == null) {
    throw new OutcomeServiceError("Prix serveur indisponible pour ce pack — devis manuel requis.", 422, "PRICE");
  }

  const deposit = input.depositCents ?? Math.min(priceCents, Math.round(priceCents * 0.4));
  if (deposit < 0 || deposit > priceCents) throw new OutcomeServiceError("Acompte invalide.");

  const deliverables =
    mission.pack?.slug === "academic-research"
      ? [
          "Problématique reformulée",
          "Carte des thèmes",
          "Tableau des sources",
          "Bibliographie annotée",
          "Références normalisées",
          "Synthèse sourcée",
          "Limites et incertitudes",
          "Sources rejetées avec justification",
          "Document rapport (JSON/texte)",
          "Evidence Ledger",
          "Rapport final",
        ]
      : ((mission.pack?.resultDescription.split(",").map((s) => s.trim()).filter(Boolean) as string[]) || [
          mission.expectedOutcome,
        ]);

  const criteria = (mission.acceptanceCriteria as string[] | null) ?? [];
  const balance = priceCents - deposit;
  const priceVersion = mission.contract ? mission.contract.version + 1 : 1;

  await db.$transaction(async (tx) => {
    if (mission.status === "QUALIFIED") {
      await transitionMission(tx, mission.id, "QUALIFIED", "QUOTED", input.actorId, "Devis établi");
    }
    await tx.outcomeMission.update({
      where: { id: mission.id },
      data: {
        estimatedCostCents: priceCents,
        quotedAt: new Date(),
        deadlineAt: input.deadlineAt ?? mission.deadlineAt,
        nextStep: "Émettre le contrat pour approbation",
      },
    });
    await tx.outcomeContract.upsert({
      where: { missionId: mission.id },
      update: {
        version: { increment: 1 },
        status: "DRAFT",
        objective: mission.expectedOutcome,
        deliverables,
        sourcesProvided: mission.sources.map((s) => ({ label: s.label, uri: s.uri, accessible: s.accessible })),
        externalSourcesAllowed: ["Sources déclarées par le client et vérifiables uniquement"],
        acceptanceCriteria: criteria,
        deadlineAt: input.deadlineAt ?? mission.deadlineAt,
        priceCents,
        depositCents: deposit,
        balanceCents: balance,
        currency: mission.currency,
        revisionsIncluded: input.revisionsIncluded ?? mission.pack?.revisionsIncluded ?? 1,
        limits: mission.exclusions ?? "Hors périmètre : fabrication de sources, données expérimentales inventées, devoir frauduleux.",
        confidentiality: mission.confidentiality,
        authorizations: ["Exécution agents gouvernés", "Quality Gate", "Revue humaine des actions sensibles"],
        humanValidationActions: ["Validation des sources externes", "Acceptation du livrable final"],
        cancellationTerms: "Annulation possible avant paiement ; après paiement, remboursement selon solde non consommé.",
        refundTerms: "Aucun remboursement automatique ; décision humaine auditée.",
        integrityWarnings: [
          "Aucune source inventée",
          "Aucun DOI inventé",
          "Distinction fait / inférence / proposition obligatoire",
          "Divulgation de l’assistance IA lorsque requise",
          `priceVersion=${priceVersion}`,
        ],
        issuedAt: null,
        acceptedAt: null,
        refusedAt: null,
      },
      create: {
        missionId: mission.id,
        status: "DRAFT",
        objective: mission.expectedOutcome,
        deliverables,
        sourcesProvided: mission.sources.map((s) => ({ label: s.label, uri: s.uri, accessible: s.accessible })),
        externalSourcesAllowed: ["Sources déclarées par le client et vérifiables uniquement"],
        acceptanceCriteria: criteria,
        deadlineAt: input.deadlineAt ?? mission.deadlineAt,
        priceCents,
        depositCents: deposit,
        balanceCents: balance,
        currency: mission.currency,
        revisionsIncluded: input.revisionsIncluded ?? mission.pack?.revisionsIncluded ?? 1,
        limits: mission.exclusions ?? "Hors périmètre : fabrication de sources, données expérimentales inventées, devoir frauduleux.",
        confidentiality: mission.confidentiality,
        authorizations: ["Exécution agents gouvernés", "Quality Gate", "Revue humaine des actions sensibles"],
        humanValidationActions: ["Validation des sources externes", "Acceptation du livrable final"],
        cancellationTerms: "Annulation possible avant paiement ; après paiement, remboursement selon solde non consommé.",
        refundTerms: "Aucun remboursement automatique ; décision humaine auditée.",
        integrityWarnings: [
          "Aucune source inventée",
          "Aucun DOI inventé",
          "Distinction fait / inférence / proposition obligatoire",
          "Divulgation de l’assistance IA lorsque requise",
          `priceVersion=${priceVersion}`,
        ],
      },
    });
    await tx.outcomeCost.deleteMany({ where: { missionId: mission.id } });
    await tx.outcomeCost.createMany({
      data: [
        { missionId: mission.id, kind: "DEPOSIT", label: "Acompte", amountCents: deposit, currency: mission.currency },
        ...(balance > 0
          ? [{ missionId: mission.id, kind: "BALANCE" as const, label: "Solde", amountCents: balance, currency: mission.currency }]
          : []),
      ],
    });
  });

  return issueContract(db, mission.id, input.actorId);
}

export async function issueContract(db: PrismaClient, missionId: string, actorId: string) {
  const mission = await db.outcomeMission.findUnique({ where: { id: missionId }, include: { contract: true } });
  if (!mission?.contract) throw new OutcomeServiceError("Contrat introuvable.", 404);
  if (mission.ownerId !== actorId) throw new OutcomeServiceError("Accès refusé.", 403, "FORBIDDEN");
  if (mission.status !== "QUOTED" && mission.status !== "AWAITING_APPROVAL") {
    throw new OutcomeServiceError(`Émission impossible depuis ${mission.status}.`, 409, "CONFLICT");
  }

  await db.$transaction(async (tx) => {
    if (mission.status === "QUOTED") {
      await transitionMission(tx, mission.id, "QUOTED", "AWAITING_APPROVAL", actorId, "Contrat émis");
    }
    await tx.outcomeContract.update({
      where: { id: mission.contract!.id },
      data: { status: "ISSUED", issuedAt: new Date() },
    });
    await tx.outcomeMission.update({
      where: { id: mission.id },
      data: { nextStep: "Accepter le contrat de résultat" },
    });
  });

  return db.outcomeMission.findUniqueOrThrow({
    where: { id: missionId },
    include: { contract: true, costs: true, sources: true, pack: true },
  });
}

export async function decideContract(
  db: PrismaClient,
  input: { missionId: string; actorId: string; decision: "accept" | "refuse" | "amend"; reason?: string },
) {
  const mission = await db.outcomeMission.findUnique({ where: { id: input.missionId }, include: { contract: true } });
  if (!mission?.contract) throw new OutcomeServiceError("Contrat introuvable.", 404);
  if (mission.ownerId !== input.actorId) throw new OutcomeServiceError("Accès refusé.", 403, "FORBIDDEN");
  if (mission.status !== "AWAITING_APPROVAL" || mission.contract.status !== "ISSUED") {
    throw new OutcomeServiceError("Décision de contrat impossible dans cet état.", 409, "CONFLICT");
  }

  if (input.decision === "refuse") {
    await db.$transaction(async (tx) => {
      await transitionMission(tx, mission.id, "AWAITING_APPROVAL", "CANCELLED", input.actorId, input.reason ?? "Contrat refusé");
      await tx.outcomeContract.update({
        where: { id: mission.contract!.id },
        data: { status: "REFUSED", refusedAt: new Date() },
      });
      await tx.outcomeMission.update({
        where: { id: mission.id },
        data: { cancelledAt: new Date(), nextStep: null },
      });
    });
    return { status: "CANCELLED" as const };
  }

  if (input.decision === "amend") {
    await db.$transaction(async (tx) => {
      await transitionMission(tx, mission.id, "AWAITING_APPROVAL", "QUOTED", input.actorId, input.reason ?? "Modification demandée");
      await tx.outcomeContract.update({
        where: { id: mission.contract!.id },
        data: { status: "AMENDMENT_REQUESTED" },
      });
      await tx.outcomeMission.update({
        where: { id: mission.id },
        data: { nextStep: "Mettre à jour le devis / contrat" },
      });
    });
    return { status: "QUOTED" as const };
  }

  await db.$transaction(async (tx) => {
    await transitionMission(tx, mission.id, "AWAITING_APPROVAL", "AWAITING_PAYMENT", input.actorId, "Contrat accepté");
    await tx.outcomeContract.update({
      where: { id: mission.contract!.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    await tx.outcomeMission.update({
      where: { id: mission.id },
      data: { approvedAt: new Date(), nextStep: "Payer l’acompte pour débloquer l’exécution" },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "OUTCOME_CONTRACT_ACCEPTED",
        entityType: "OutcomeMission",
        entityId: mission.id,
        newValue: { contractId: mission.contract!.id },
      },
    });
  });

  return { status: "AWAITING_PAYMENT" as const };
}

/** Déblocage après paiement confirmé (idempotent). */
export async function unlockMissionAfterPayment(
  db: DbClient,
  input: { missionId: string; paymentIntentId: string; actorId?: string | null },
) {
  const mission = await db.outcomeMission.findUnique({
    where: { id: input.missionId },
    include: { costs: true, milestones: true },
  });
  if (!mission) return { unlocked: false as const, reason: "missing" as const };

  if (mission.status === "PLANNED" || mission.status === "READY" || mission.status === "EXECUTING" || mission.status === "COMPLETED") {
    return { unlocked: true as const, reason: "already" as const };
  }
  if (mission.status !== "AWAITING_PAYMENT" && mission.status !== "REVISION_REQUESTED") {
    return { unlocked: false as const, reason: "wrong_status" as const };
  }

  const from = mission.status;
  assertTransition(from, "PLANNED");
  const now = new Date();
  await db.outcomeMission.updateMany({
    where: { id: mission.id, status: from },
    data: {
      status: "PLANNED",
      paidAt: now,
      nextStep: "Générer le plan d’exécution",
    },
  });
  await db.outcomeStatusTransition.create({
    data: {
      missionId: mission.id,
      fromStatus: from,
      toStatus: "PLANNED",
      actorId: input.actorId ?? undefined,
      reason: `Paiement confirmé (${input.paymentIntentId})`,
    },
  });
  await db.outcomeEvidence.create({
    data: {
      missionId: mission.id,
      kind: "PAYMENT",
      title: "Paiement confirmé",
      summary: "Acompte ou jalon débloquant la mission",
      payload: { paymentIntentId: input.paymentIntentId },
      invented: false,
      checksum: createHash("sha256").update(input.paymentIntentId).digest("hex"),
    },
  });
  const deposit = mission.costs.find((c) => c.kind === "DEPOSIT");
  if (deposit && !deposit.paidAt) {
    await db.outcomeCost.update({ where: { id: deposit.id }, data: { paidAt: now } });
  }
  if (mission.milestones.length === 0) {
    await db.outcomeMilestone.create({
      data: {
        missionId: mission.id,
        key: "execution",
        title: "Exécution mission",
        amountCents: deposit?.amountCents ?? mission.estimatedCostCents ?? 0,
        unlockedAt: now,
      },
    });
  } else {
    await db.outcomeMilestone.updateMany({
      where: { missionId: mission.id, unlockedAt: null },
      data: { unlockedAt: now },
    });
  }
  return { unlocked: true as const, reason: "activated" as const };
}

export async function acceptMission(
  db: PrismaClient,
  input: { missionId: string; actorId: string; decision: "ACCEPTED" | "REVISION_REQUESTED"; comment?: string },
) {
  const mission = await db.outcomeMission.findUnique({
    where: { id: input.missionId },
    include: { deliverables: true },
  });
  if (!mission) throw new OutcomeServiceError("Mission introuvable.", 404);
  if (mission.ownerId !== input.actorId) throw new OutcomeServiceError("Accès refusé.", 403, "FORBIDDEN");
  if (mission.status !== "DELIVERED") throw new OutcomeServiceError("Acceptation possible uniquement après livraison.", 409, "CONFLICT");
  if (!mission.deliverables.some((d) => d.status === "DELIVERED" || d.status === "READY")) {
    throw new OutcomeServiceError("Aucun livrable disponible.", 409, "CONFLICT");
  }

  if (input.decision === "REVISION_REQUESTED") {
    const openRevisions = await db.outcomeRevision.count({
      where: { missionId: mission.id, status: "OPEN" },
    });
    const contract = await db.outcomeContract.findUnique({ where: { missionId: mission.id } });
    const maxRevisions = contract?.revisionsIncluded ?? 1;
    const totalRevisions = await db.outcomeRevision.count({ where: { missionId: mission.id } });
    if (totalRevisions >= maxRevisions || openRevisions > 0) {
      throw new OutcomeServiceError(
        `Limite de révisions atteinte (${totalRevisions}/${maxRevisions}).`,
        409,
        "REVISION_LIMIT",
      );
    }
    await db.$transaction(async (tx) => {
      await transitionMission(tx, mission.id, "DELIVERED", "REVISION_REQUESTED", input.actorId, input.comment);
      await tx.outcomeRevision.create({
        data: {
          missionId: mission.id,
          requesterId: input.actorId,
          reason: input.comment ?? "Correction demandée",
        },
      });
      await tx.outcomeAcceptance.upsert({
        where: { missionId: mission.id },
        update: { decision: "REVISION_REQUESTED", comment: input.comment, actorId: input.actorId, decidedAt: new Date() },
        create: {
          missionId: mission.id,
          actorId: input.actorId,
          decision: "REVISION_REQUESTED",
          comment: input.comment,
        },
      });
      await tx.outcomeMission.update({
        where: { id: mission.id },
        data: { nextStep: "Traiter la demande de révision" },
      });
    });
    return { status: "REVISION_REQUESTED" as const };
  }

  await db.$transaction(async (tx) => {
    await transitionMission(tx, mission.id, "DELIVERED", "ACCEPTED", input.actorId, input.comment);
    await transitionMission(tx, mission.id, "ACCEPTED", "COMPLETED", input.actorId, "Mission terminée");
    await tx.outcomeAcceptance.upsert({
      where: { missionId: mission.id },
      update: { decision: "ACCEPTED", comment: input.comment, actorId: input.actorId, decidedAt: new Date() },
      create: {
        missionId: mission.id,
        actorId: input.actorId,
        decision: "ACCEPTED",
        comment: input.comment,
      },
    });
    await tx.outcomeMission.update({
      where: { id: mission.id },
      data: {
        acceptedAt: new Date(),
        completedAt: new Date(),
        nextStep: null,
      },
    });
    await tx.outcomeDeliverable.updateMany({
      where: { missionId: mission.id, status: "DELIVERED" },
      data: { status: "ACCEPTED" },
    });
  });

  return { status: "COMPLETED" as const };
}

export async function getMissionForOwner(db: PrismaClient, missionId: string, ownerId: string) {
  const mission = await db.outcomeMission.findFirst({
    where: { id: missionId, ownerId },
    include: {
      pack: true,
      sources: true,
      contract: true,
      plan: true,
      tasks: { orderBy: { createdAt: "asc" } },
      agentAssignments: { include: { agent: true } },
      approvals: { orderBy: { createdAt: "desc" } },
      evidences: { orderBy: { createdAt: "asc" } },
      deliverables: { orderBy: { createdAt: "asc" } },
      qualityChecks: true,
      revisions: true,
      acceptance: true,
      costs: true,
      milestones: true,
      statusTransitions: { orderBy: { createdAt: "asc" } },
      paymentIntents: { select: { id: true, publicRef: true, status: true, amountCents: true, currency: true, activatedAt: true } },
      invoices: { select: { id: true, number: true, status: true, amountDueCents: true, amountPaidCents: true, currency: true } },
    },
  });
  if (!mission) throw new OutcomeServiceError("Mission introuvable.", 404);
  return mission;
}

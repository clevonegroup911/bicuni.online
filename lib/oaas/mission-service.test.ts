import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const outcomeMission = {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const outcomeStatusTransition = { create: vi.fn() };
  const outcomeContract = { upsert: vi.fn(), update: vi.fn() };
  const outcomeCost = { deleteMany: vi.fn(), createMany: vi.fn(), update: vi.fn() };
  const outcomeEvidence = { create: vi.fn() };
  const outcomeMilestone = { create: vi.fn(), updateMany: vi.fn() };
  const outcomePack = { upsert: vi.fn() };
  const auditLog = { create: vi.fn() };
  const db = {
    outcomeMission,
    outcomeStatusTransition,
    outcomeContract,
    outcomeCost,
    outcomeEvidence,
    outcomeMilestone,
    outcomePack,
    auditLog,
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  };
  return { db, outcomeMission, outcomeStatusTransition, outcomeContract, outcomeCost, outcomeEvidence, outcomeMilestone, outcomePack, auditLog };
});

vi.mock("@/lib/db/client", () => ({ db: mocks.db }));

import { createMission, decideContract, unlockMissionAfterPayment } from "@/lib/oaas/mission-service";

describe("outcome mission service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.$transaction.mockImplementation(async (fn: (tx: typeof mocks.db) => Promise<unknown>) => fn(mocks.db));
    mocks.outcomeMission.updateMany.mockResolvedValue({ count: 1 });
  });

  it("crée une mission DRAFT avec pack academic-research", async () => {
    mocks.outcomePack.upsert.mockResolvedValue({ id: "pack-1", slug: "academic-research" });
    mocks.outcomeMission.create.mockResolvedValue({
      id: "m1",
      publicRef: "OM-TEST",
      status: "DRAFT",
      sources: [],
      pack: { slug: "academic-research" },
    });
    mocks.auditLog.create.mockResolvedValue({});

    const mission = await createMission(mocks.db as never, {
      ownerId: "user-1",
      packSlug: "academic-research",
      title: "Mission test",
      originalRequest: "Question de recherche suffisamment longue",
      expectedOutcome: "Dossier de recherche vérifié",
      sources: [{ label: "Source A", accessible: true }],
    });

    expect(mission.status).toBe("DRAFT");
    expect(mocks.outcomePack.upsert).toHaveBeenCalled();
    expect(mocks.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "OUTCOME_MISSION_CREATED" }),
      }),
    );
  });

  it("accepte le contrat puis passe en AWAITING_PAYMENT", async () => {
    mocks.outcomeMission.findUnique.mockResolvedValue({
      id: "m1",
      ownerId: "user-1",
      status: "AWAITING_APPROVAL",
      contract: { id: "c1", status: "ISSUED" },
    });
    mocks.outcomeContract.update.mockResolvedValue({});
    mocks.outcomeMission.update.mockResolvedValue({});
    mocks.auditLog.create.mockResolvedValue({});

    const result = await decideContract(mocks.db as never, {
      missionId: "m1",
      actorId: "user-1",
      decision: "accept",
    });
    expect(result.status).toBe("AWAITING_PAYMENT");
    expect(mocks.outcomeMission.updateMany).toHaveBeenCalled();
  });

  it("débloque la mission après paiement de façon idempotente", async () => {
    mocks.outcomeMission.findUnique.mockResolvedValue({
      id: "m1",
      status: "AWAITING_PAYMENT",
      estimatedCostCents: 10000,
      costs: [{ id: "cost-1", kind: "DEPOSIT", paidAt: null, amountCents: 4000 }],
      milestones: [],
    });
    mocks.outcomeEvidence.create.mockResolvedValue({});
    mocks.outcomeMilestone.create.mockResolvedValue({});
    mocks.outcomeStatusTransition.create.mockResolvedValue({});
    mocks.outcomeCost.update.mockResolvedValue({});

    const first = await unlockMissionAfterPayment(mocks.db as never, {
      missionId: "m1",
      paymentIntentId: "pi-1",
    });
    expect(first.unlocked).toBe(true);

    mocks.outcomeMission.findUnique.mockResolvedValue({
      id: "m1",
      status: "PLANNED",
      costs: [],
      milestones: [{ id: "ms-1" }],
    });
    const second = await unlockMissionAfterPayment(mocks.db as never, {
      missionId: "m1",
      paymentIntentId: "pi-1",
    });
    expect(second.reason).toBe("already");
  });
});

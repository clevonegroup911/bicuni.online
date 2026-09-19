import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import {
  OutcomeServiceError,
  acceptMission,
  createMission,
  decideContract,
  getMissionForOwner,
  qualifyMission,
  quoteAndIssueContract,
} from "@/lib/oaas/mission-service";
import {
  buildExecutionPlan,
  decideApproval,
  executeMissionStep,
  runOrchestratorUntilPause,
} from "@/lib/oaas/orchestrator";
import { ClevonePaymentService } from "@/lib/payments/clevone/service";

const createSchema = z.object({
  packSlug: z.string().optional(),
  title: z.string().min(3).max(200),
  originalRequest: z.string().min(10).max(8000),
  expectedOutcome: z.string().min(10).max(4000),
  language: z.string().min(2).max(16).optional(),
  academicDomain: z.string().max(200).optional(),
  academicLevel: z.string().max(120).optional(),
  scope: z.string().max(4000).optional(),
  exclusions: z.string().max(4000).optional(),
  deadlineAt: z.string().datetime().optional().nullable(),
  maxBudgetCents: z.number().int().nonnegative().optional().nullable(),
  confidentiality: z.enum(["STANDARD", "RESTRICTED", "CONFIDENTIAL", "STRICT"]).optional(),
  acceptanceCriteria: z.array(z.string().min(3).max(500)).max(20).optional(),
  sources: z
    .array(
      z.object({
        label: z.string().min(2).max(300),
        uri: z.string().url().optional(),
        notes: z.string().max(1000).optional(),
        accessible: z.boolean().optional(),
      }),
    )
    .max(50)
    .optional(),
});

async function requireSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
}

function errorResponse(error: unknown) {
  if (error instanceof OutcomeServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
}

export async function GET() {
  const user = await requireSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const missions = await db.outcomeMission.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      pack: { select: { slug: true, title: true } },
      approvals: { where: { status: "PENDING" }, select: { id: true, title: true } },
      tasks: { select: { status: true } },
    },
  });
  return NextResponse.json({ missions });
}

export async function POST(request: Request) {
  const user = await requireSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    const body = createSchema.parse(await request.json());
    const mission = await createMission(db, {
      ownerId: user.id,
      packSlug: body.packSlug,
      title: body.title,
      originalRequest: body.originalRequest,
      expectedOutcome: body.expectedOutcome,
      language: body.language,
      academicDomain: body.academicDomain,
      academicLevel: body.academicLevel,
      scope: body.scope,
      exclusions: body.exclusions,
      deadlineAt: body.deadlineAt ? new Date(body.deadlineAt) : null,
      maxBudgetCents: body.maxBudgetCents,
      confidentiality: body.confidentiality,
      acceptanceCriteria: body.acceptanceCriteria,
      sources: body.sources,
    });
    return NextResponse.json({ mission }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides.", details: error.flatten() }, { status: 400 });
    }
    return errorResponse(error);
  }
}

export async function handleMissionAction(
  missionId: string,
  action: string,
  request: Request,
) {
  const user = await requireSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    switch (action) {
      case "get":
        return NextResponse.json({ mission: await getMissionForOwner(db, missionId, user.id) });
      case "qualify":
        return NextResponse.json({ mission: await qualifyMission(db, missionId, user.id) });
      case "quote": {
        const body = z
          .object({
            priceCents: z.number().int().nonnegative().optional(),
            depositCents: z.number().int().nonnegative().optional(),
            deadlineAt: z.string().datetime().optional().nullable(),
            revisionsIncluded: z.number().int().min(0).max(5).optional(),
          })
          .parse(await request.json().catch(() => ({})));
        const mission = await quoteAndIssueContract(db, {
          missionId,
          actorId: user.id,
          priceCents: body.priceCents,
          depositCents: body.depositCents,
          deadlineAt: body.deadlineAt ? new Date(body.deadlineAt) : null,
          revisionsIncluded: body.revisionsIncluded,
        });
        return NextResponse.json({ mission });
      }
      case "contract": {
        const body = z
          .object({ decision: z.enum(["accept", "refuse", "amend"]), reason: z.string().max(1000).optional() })
          .parse(await request.json());
        return NextResponse.json(await decideContract(db, { missionId, actorId: user.id, ...body }));
      }
      case "checkout": {
        const body = z
          .object({
            channel: z.enum(["MPESA", "RAWBANK"]),
            idempotencyKey: z.string().min(8).max(128),
          })
          .parse(await request.json());
        const result = await new ClevonePaymentService().createOutcomeCheckout({
          userId: user.id,
          missionId,
          channel: body.channel,
          idempotencyKey: body.idempotencyKey,
        });
        return NextResponse.json(result);
      }
      case "pay-test": {
        const { confirmTestOutcomePayment } = await import("@/lib/oaas/test-payment");
        const body = z
          .object({
            idempotencyKey: z.string().min(8).max(128),
          })
          .parse(await request.json().catch(() => ({ idempotencyKey: `oaas-test:${missionId}:${user.id}` })));
        return NextResponse.json(
          await confirmTestOutcomePayment(db, {
            missionId,
            userId: user.id,
            idempotencyKey: body.idempotencyKey,
          }),
        );
      }
      case "plan":
        return NextResponse.json({ mission: await buildExecutionPlan(db, missionId, user.id) });
      case "step":
        return NextResponse.json(await executeMissionStep(db, missionId, user.id));
      case "run":
        return NextResponse.json(await runOrchestratorUntilPause(db, missionId, user.id));
      case "accept": {
        const body = z
          .object({
            decision: z.enum(["ACCEPTED", "REVISION_REQUESTED"]),
            comment: z.string().max(2000).optional(),
          })
          .parse(await request.json());
        return NextResponse.json(await acceptMission(db, { missionId, actorId: user.id, ...body }));
      }
      case "approval": {
        const body = z
          .object({
            approvalId: z.string().min(1),
            decision: z.enum(["APPROVED", "REJECTED"]),
            reason: z.string().max(1000).optional(),
          })
          .parse(await request.json());
        return NextResponse.json(await decideApproval(db, { ...body, actorId: user.id }));
      }
      default:
        return NextResponse.json({ error: "Action inconnue." }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides.", details: error.flatten() }, { status: 400 });
    }
    return errorResponse(error);
  }
}

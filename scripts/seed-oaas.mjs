#!/usr/bin/env node
/**
 * Seed OaaS — DATASET: TEST / DEMO
 * Déterministe, idempotent, sans identifiants de production.
 * Relançable sans doublon (upsert par slug/key/email).
 */
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { AGENT_REGISTRY, agentAvailableFlag } from "../lib/oaas/agents";
import { OUTCOME_PACK_CATALOG } from "../lib/oaas/catalog";

const db = new PrismaClient();

const TEST_OWNER_EMAIL = "oaas-owner@example.test";
const TEST_OTHER_EMAIL = "oaas-other@example.test";
const TEST_MISSION_REF_PREFIX = "OM-TEST-";

async function upsertTestUser(email, name, role = "STUDENT") {
  return db.user.upsert({
    where: { email },
    update: { name, role, status: "ACTIVE", emailVerified: new Date("2026-01-01T00:00:00.000Z") },
    create: {
      email,
      name,
      role,
      status: "ACTIVE",
      emailVerified: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
}

async function main() {
  console.log("[TEST] Seed OaaS — début (idempotent)");

  for (const pack of OUTCOME_PACK_CATALOG) {
    await db.outcomePack.upsert({
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

    // Ne créer un Plan facturable que si un prix indicatif réel est défini.
    if (pack.planSlug && pack.indicativePriceCents != null && pack.indicativePriceCents > 0) {
      await db.plan.upsert({
        where: { slug: pack.planSlug },
        update: {
          name: `[TEST] ${pack.title}`,
          priceCents: pack.indicativePriceCents,
          interval: "one_time",
          features: {
            oaas: true,
            packSlug: pack.slug,
            pricingIndicative: true,
            dataset: "TEST",
          },
          active: true,
        },
        create: {
          slug: pack.planSlug,
          name: `[TEST] ${pack.title}`,
          priceCents: pack.indicativePriceCents,
          currency: "USD",
          interval: "one_time",
          features: {
            oaas: true,
            packSlug: pack.slug,
            pricingIndicative: true,
            dataset: "TEST",
          },
          active: true,
        },
      });
    }
  }

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
        confidenceLevel: agent.confidenceLevel,
        available,
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

  const owner = await upsertTestUser(TEST_OWNER_EMAIL, "TEST OaaS Owner");
  await upsertTestUser(TEST_OTHER_EMAIL, "TEST OaaS Other");

  const academicPack = await db.outcomePack.findUniqueOrThrow({ where: { slug: "academic-research" } });
  const publicRef = `${TEST_MISSION_REF_PREFIX}SEED001`;

  const existing = await db.outcomeMission.findUnique({ where: { publicRef } });
  if (!existing) {
    await db.outcomeMission.create({
      data: {
        publicRef,
        ownerId: owner.id,
        packId: academicPack.id,
        title: "[TEST] Mission seed recherche académique",
        originalRequest:
          "[TEST] Besoin d’un dossier de recherche sourcé sur l’agriculture durable au Kivu, à partir des sources fournies uniquement.",
        expectedOutcome:
          "[TEST] Problématique reformulée, tableau de sources, bibliographie annotée, synthèse sourcée et Evidence Ledger.",
        language: "fr",
        academicDomain: "Sciences agricoles",
        academicLevel: "Master",
        scope: "Sources client uniquement — dataset TEST",
        exclusions: "Aucune invention de DOI ni de source",
        confidentiality: "STANDARD",
        acceptanceCriteria: academicPack.acceptanceCriteria,
        status: "DRAFT",
        nextStep: "Qualification de la demande",
        integrityDeclaration:
          "[TEST] BICUNI assiste, structure, vérifie et documente. Aucune source inventée.",
        aiAssistanceLevel: "assisted",
        estimatedCostCents: academicPack.indicativePriceCents,
        sources: {
          create: [
            {
              label: "[TEST] FAO — Agriculture durable (fixture)",
              uri: "https://example.test/fixtures/fao-agriculture-durable",
              notes: "Fixture TEST — non production",
              accessible: true,
            },
            {
              label: "[TEST] Source inaccessible déclarée",
              uri: "https://example.test/fixtures/inaccessible",
              notes: "Fixture TEST — accessible=false",
              accessible: false,
            },
          ],
        },
      },
    });
  }

  const agentCount = await db.outcomeAgent.count();
  const packCount = await db.outcomePack.count({ where: { active: true } });
  const availableAgents = await db.outcomeAgent.count({ where: { available: true } });
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ packs: packCount, agents: agentCount, availableAgents, publicRef }))
    .digest("hex")
    .slice(0, 12);

  console.log(
    `[TEST] Seed OaaS OK — packs=${packCount} agents=${agentCount} available=${availableAgents} mission=${publicRef} fp=${fingerprint}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

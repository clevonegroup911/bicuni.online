import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { closeSearchCache } from "../lib/search/cache";
import { SearchIndexer } from "../lib/search/indexer";
import { DocumentDomainError, DocumentService } from "../lib/documents/document-service";
import { ReviewService } from "../lib/documents/review-service";
import { getCurrentSubscription, hasActiveSubscription } from "../lib/subscriptions/service";

const db = new PrismaClient();
const runId = randomUUID();
const ids = { userIds: [] as string[], categoryIds: [] as string[], universityIds: [] as string[], documentIds: [] as string[] };

test.afterAll(async () => {
  await db.document.deleteMany({ where: { id: { in: ids.documentIds } } });
  await db.university.deleteMany({ where: { id: { in: ids.universityIds } } });
  await db.category.deleteMany({ where: { id: { in: ids.categoryIds } } });
  await db.user.deleteMany({ where: { id: { in: ids.userIds } } });
  for (const documentId of ids.documentIds) await new SearchIndexer().syncDocument(documentId);
  await Promise.all([db.$disconnect(), closeSearchCache()]);
});

test("workflow documentaire réel, rejet obligatoire et permissions universitaires", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Le workflow backend ne doit être exécuté qu’une fois.");
  const [student, admin, outsider] = await Promise.all([
    db.user.create({ data: { email: `student-${runId}@example.test`, role: "STUDENT", emailVerified: new Date() } }),
    db.user.create({ data: { email: `admin-${runId}@example.test`, role: "UNIVERSITY_ADMIN", emailVerified: new Date() } }),
    db.user.create({ data: { email: `outsider-${runId}@example.test`, role: "UNIVERSITY_ADMIN", emailVerified: new Date() } }),
  ]);
  ids.userIds.push(student.id, admin.id, outsider.id);
  const university = await db.university.create({ data: { name: `Université E2E ${runId}`, slug: `university-${runId}`, country: "CD", admins: { connect: { id: admin.id } } } });
  ids.universityIds.push(university.id);
  const category = await db.category.create({ data: { name: `Catégorie E2E ${runId}`, slug: `category-${runId}` } });
  ids.categoryIds.push(category.id);

  const createDocument = async (suffix: string) => {
    const document = await db.document.create({ data: { slug: `e2e-${suffix}-${runId}`, title: `Document ${suffix}`, authorId: student.id, universityId: university.id, categoryId: category.id, files: { create: { objectKey: `e2e/${runId}/${suffix}.pdf`, fileName: `${suffix}.pdf`, mimeType: "application/pdf", sizeBytes: 100, checksum: "a".repeat(64), isUploaded: true } } } });
    ids.documentIds.push(document.id);
    return document;
  };

  const approved = await createDocument("approved");
  await new DocumentService().submit(approved.id, student);
  await expect(new ReviewService().review(approved.id, outsider, { decision: "APPROVED" })).rejects.toMatchObject({ status: 403 });
  await new ReviewService().review(approved.id, admin, { decision: "APPROVED" });
  await new ReviewService().archive(approved.id, admin);
  await expect(db.document.findUniqueOrThrow({ where: { id: approved.id } })).resolves.toMatchObject({ status: "ARCHIVED" });

  const rejected = await createDocument("rejected");
  await new DocumentService().submit(rejected.id, student);
  await expect(new ReviewService().review(rejected.id, admin, { decision: "REJECTED" })).rejects.toBeInstanceOf(DocumentDomainError);
  await new ReviewService().review(rejected.id, admin, { decision: "REJECTED", comment: "Métadonnées incomplètes" });

  const deleted = await createDocument("deleted");
  await new DocumentService().softDelete(deleted.id, student);
  await expect(db.document.findUniqueOrThrow({ where: { id: deleted.id } })).resolves.toMatchObject({ status: "DELETED" });
});

test("outbox, indexation, tolérance aux fautes, filtre et archivage", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’intégration recherche ne doit être exécutée qu’une fois.");
  const user = await db.user.create({ data: { email: `search-${runId}@example.test`, name: "Auteur Indexation", role: "RESEARCHER", emailVerified: new Date() } });
  ids.userIds.push(user.id);
  const category = await db.category.create({ data: { name: `Sciences E2E ${runId}`, slug: `science-${runId}` } });
  ids.categoryIds.push(category.id);
  const document = await db.document.create({ data: { slug: `search-${runId}`, title: `Agriculture durable Kivu ${runId}`, authorId: user.id, categoryId: category.id, language: "fr", type: "ARTICLE", status: "APPROVED", publishedAt: new Date() } });
  ids.documentIds.push(document.id);

  const sync = await new SearchIndexer().processOutbox(100);
  expect(sync.processed).toBeGreaterThan(0);
  await expect.poll(async () => (await request.get(`/api/search?q=Agriculure&page=1&pageSize=20&language=fr&type=ARTICLE`)).json(), { timeout: 20_000 }).toMatchObject({ totalDocuments: 1 });

  await db.document.update({ where: { id: document.id }, data: { title: `Agroécologie Kivu ${runId}` } });
  await new SearchIndexer().processOutbox(100);
  await expect.poll(async () => (await request.get(`/api/search?q=Agroecologie&page=1&pageSize=20`)).json(), { timeout: 20_000 }).toMatchObject({ totalDocuments: 1 });

  await db.document.update({ where: { id: document.id }, data: { status: "ARCHIVED" } });
  await new SearchIndexer().processOutbox(100);
  await expect.poll(async () => (await request.get(`/api/search?q=Agroecologie&page=1&pageSize=20`)).json(), { timeout: 20_000 }).toMatchObject({ totalDocuments: 0 });
});

test("abonnements inactif, expiré, actif et changement de plan", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’intégration abonnement ne doit être exécutée qu’une fois.");
  const user = await db.user.create({ data: { email: `subscription-${runId}@example.test`, role: "STUDENT", emailVerified: new Date() } });
  ids.userIds.push(user.id);
  const starter = await db.plan.findUniqueOrThrow({ where: { slug: "starter" } });
  const premium = await db.plan.findUniqueOrThrow({ where: { slug: "student-premium" } });
  expect(await hasActiveSubscription(user.id)).toBe(false);
  const subscription = await db.subscription.create({ data: { userId: user.id, planId: starter.id, status: "INCOMPLETE", providerRef: `subscription-${runId}` } });
  expect(await hasActiveSubscription(user.id)).toBe(false);
  await db.subscription.update({ where: { id: subscription.id }, data: { status: "ACTIVE", currentPeriodEnd: new Date(Date.now() - 1_000) } });
  expect(await hasActiveSubscription(user.id)).toBe(false);
  await db.subscription.update({ where: { id: subscription.id }, data: { currentPeriodEnd: new Date(Date.now() + 86_400_000) } });
  expect(await hasActiveSubscription(user.id)).toBe(true);
  await db.subscription.update({ where: { id: subscription.id }, data: { planId: premium.id } });
  await expect(getCurrentSubscription(user.id)).resolves.toMatchObject({ plan: { slug: "student-premium" } });
});

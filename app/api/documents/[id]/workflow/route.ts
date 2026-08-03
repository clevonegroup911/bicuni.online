import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { DocumentDomainError, DocumentService } from "@/lib/documents/document-service";
import { ReviewService } from "@/lib/documents/review-service";
import { reviewSchema } from "@/lib/validators/document";

const inputSchema = z.discriminatedUnion("action", [z.object({ action: z.literal("submit") }), z.object({ action: z.literal("archive") }), z.object({ action: z.literal("review"), review: reviewSchema })]);
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  try { const id = (await params).id; const result = parsed.data.action === "submit" ? await new DocumentService().submit(id, session.user) : parsed.data.action === "archive" ? await new ReviewService().archive(id, session.user) : await new ReviewService().review(id, session.user, parsed.data.review); return NextResponse.json(result); }
  catch (error) { return error instanceof DocumentDomainError ? NextResponse.json({ error: error.message }, { status: error.status }) : NextResponse.json({ error: "Erreur interne." }, { status: 500 }); }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { DocumentService } from "@/lib/documents/document-service";

const querySchema = z.object({ q: z.string().trim().max(200).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(12) });
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  return NextResponse.json(await new DocumentService().listPublic({ page: parsed.data.page, pageSize: parsed.data.pageSize, query: parsed.data.q }));
}

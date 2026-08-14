import { NextResponse } from "next/server";
import { PersistentIdentifierError } from "@/lib/pid/errors";
import { PersistentIdentifierService } from "@/lib/pid/service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ identifier: string[] }> }) {
  const identifier = ((await params).identifier ?? []).join("/");
  try {
    return NextResponse.json(await new PersistentIdentifierService().getPublicByIdentifier(identifier));
  } catch (error) {
    if (error instanceof PersistentIdentifierError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}

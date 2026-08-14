import { NextResponse } from "next/server";
import { AdminAuthorizationError } from "@/lib/admin/guard";
import { PersistentIdentifierError } from "./errors";

export function pidAdminError(error: unknown) {
  if (error instanceof AdminAuthorizationError || error instanceof PersistentIdentifierError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Erreur administrative interne." }, { status: 500 });
}

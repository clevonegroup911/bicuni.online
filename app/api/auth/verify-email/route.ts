import { NextResponse } from "next/server";
import { verifyEmailAddress } from "@/lib/auth/email-verification";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown; email?: unknown } | null;
  if (typeof body?.token !== "string" || typeof body.email !== "string") {
    return NextResponse.json({ error: "Lien de vérification invalide." }, { status: 400 });
  }

  const result = await verifyEmailAddress(body.email, body.token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ message: result.message });
}

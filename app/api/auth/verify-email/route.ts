import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { hashToken } from "@/lib/auth/tokens";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown; email?: unknown } | null;
  if (typeof body?.token !== "string" || typeof body.email !== "string") {
    return NextResponse.json({ error: "Lien de vérification invalide." }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const tokenHash = hashToken(body.token);
  const verification = await db.verificationToken.findUnique({
    where: { token: tokenHash },
  });

  if (!verification || verification.identifier !== email || verification.expires <= new Date()) {
    return NextResponse.json({ error: "Ce lien est invalide ou expiré." }, { status: 400 });
  }

  await db.$transaction([
    db.user.update({ where: { email }, data: { emailVerified: new Date() } }),
    db.verificationToken.delete({ where: { token: tokenHash } }),
  ]);

  return NextResponse.json({ message: "Adresse vérifiée. Vous pouvez vous connecter." });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentSubscription } from "@/lib/subscriptions/service";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const subscription = await getCurrentSubscription(session.user.id);
  return NextResponse.json({ subscription });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { StatisticsService } from "@/lib/documents/statistics-service";
import { db } from "@/lib/db/client";
export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) { const session = await auth(); if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });const id=(await params).id;const visible=await db.document.count({where:{id,status:{in:["APPROVED","PUBLISHED"]},deletedAt:null}});if(!visible)return NextResponse.json({error:"Document introuvable."},{status:404}); const favorite = await new StatisticsService().toggleFavorite(id, session.user.id); return NextResponse.json({ favorite }); }

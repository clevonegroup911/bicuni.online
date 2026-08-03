import { NextResponse } from "next/server";
import { StatisticsService } from "@/lib/documents/statistics-service";
import { db } from "@/lib/db/client";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { const id=(await params).id;const visible=await db.document.count({where:{id,status:{in:["APPROVED","PUBLISHED"]},deletedAt:null}});if(!visible)return NextResponse.json({error:"Document introuvable."},{status:404});return NextResponse.json(await new StatisticsService().recordView(id)); }

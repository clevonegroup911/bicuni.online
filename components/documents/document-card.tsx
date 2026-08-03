import Link from "next/link";
import { BookOpen, Download, Eye, Heart } from "lucide-react";
import type { DocumentStatus, DocumentType } from "@prisma/client";
import { StatusBadge } from "@/components/documents/status-badge";

export type DocumentSummary = { id: string; title: string; abstract: string | null; type: DocumentType; status: DocumentStatus; year: number | null; viewCount: number; downloadCount: number; favoriteCount: number; author: { name: string | null }; university: { name: string } | null; category: { name: string } };
export function AcademicDocumentCard({ document }: { document: DocumentSummary }) { return <article className="glass card document-card"><div className="document-card-top"><span className="eyebrow"><BookOpen size={14}/>{document.type}</span><StatusBadge status={document.status}/></div><h2><Link href={`/documents/${document.id}`}>{document.title}</Link></h2><p className="document-abstract">{document.abstract}</p><p className="document-byline">{document.author.name ?? "Auteur BICUNI"} · {document.university?.name ?? "Institution indépendante"} · {document.year}</p><div className="document-card-footer"><span>{document.category.name}</span><span><Eye size={14}/>{document.viewCount}</span><span><Download size={14}/>{document.downloadCount}</span><span><Heart size={14}/>{document.favoriteCount}</span></div></article>; }

import { NextResponse } from "next/server";
import { PersistentIdentifierError } from "@/lib/pid/errors";
import { PersistentIdentifierService } from "@/lib/pid/service";
import { pidStatusPage } from "@/lib/pid/status-page";
import { parseResolverParts } from "@/lib/pid/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ prefix: string; suffix: string[] }> },
) {
  const { prefix, suffix } = await params;
  const identifierHint = [prefix, ...(suffix ?? [])].join("/");
  try {
    const parts = parseResolverParts(prefix, suffix ?? []);
    const result = await new PersistentIdentifierService().resolve(`${parts.prefix}/${parts.suffix}`);
    if (result.outcome === "invalid") {
      return html(400, "Identifiant BICUNI invalide", identifierHint, "La forme de cet identifiant pérenne n’est pas reconnue.");
    }
    if (result.outcome === "not_found") {
      return html(404, "Identifiant BICUNI introuvable", result.identifier, "Aucun identifiant pérenne BICUNI ne correspond à cette référence. L’adresse a pu être saisie de manière inexacte.");
    }
    if (result.outcome === "gone") {
      return html(410, "Ressource BICUNI indisponible", result.identifier, "Cette ressource n’est plus disponible. L’identifiant pérenne reste enregistré dans le résolveur BICUNI et n’a pas été supprimé.");
    }
    return NextResponse.redirect(result.targetUrl, { status: 302, headers: NO_STORE });
  } catch (error) {
    if (error instanceof PersistentIdentifierError && error.status === 400) {
      return html(400, "Identifiant BICUNI invalide", identifierHint, "La forme de cet identifiant pérenne n’est pas reconnue.");
    }
    return html(500, "Résolution indisponible", identifierHint, "Le résolveur BICUNI a rencontré une erreur interne.");
  }
}

function html(status: 400 | 404 | 410 | 500, title: string, identifier: string, body: string) {
  const pageStatus = status === 500 ? 404 : status;
  const content = pidStatusPage({
    status: pageStatus === 400 || pageStatus === 404 || pageStatus === 410 ? pageStatus : 404,
    title,
    identifier,
    body,
  });
  return new NextResponse(content, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE },
  });
}

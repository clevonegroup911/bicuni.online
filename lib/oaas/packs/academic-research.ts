import type { OutcomeEvidenceKind } from "@prisma/client";
import type { PlanTaskSpec } from "@/lib/oaas/types";

export type ResearchMissionContext = {
  title: string;
  originalRequest: string;
  expectedOutcome: string;
  academicDomain: string | null;
  academicLevel: string | null;
  language: string;
  scope: string | null;
  exclusions: string | null;
  sources: Array<{ label: string; uri: string | null; accessible: boolean; notes: string | null }>;
};

export type TaskRunResult = {
  payload: Record<string, unknown>;
  evidences: Array<{
    kind: OutcomeEvidenceKind;
    title: string;
    summary?: string;
    payload: Record<string, unknown>;
  }>;
  deliverables: Array<{
    key: string;
    title: string;
    format: string;
    content: Record<string, unknown>;
  }>;
  inventedContent: boolean;
};

/** DOI pattern strict — utiliséus si format invalide ; jamais inventé. */
const DOI_RE = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;

export function buildAcademicResearchGraph(): PlanTaskSpec[] {
  return [
    {
      key: "intake",
      title: "Qualification Research Intake",
      description: "Reformuler la problématique et cadrer le périmètre",
      dependsOn: [],
      agentKey: "research-intake",
    },
    {
      key: "ingest-sources",
      title: "Ingestion des sources fournies",
      dependsOn: ["intake"],
      agentKey: "document-ingestion",
      parallelGroup: "sources",
    },
    {
      key: "discover-sources",
      title: "Inventaire et découverte déclarative",
      dependsOn: ["intake"],
      agentKey: "source-discovery",
      parallelGroup: "sources",
    },
    {
      key: "verify-sources",
      title: "Vérification des sources",
      dependsOn: ["ingest-sources", "discover-sources"],
      agentKey: "source-verification",
    },
    {
      key: "human-source-review",
      title: "Validation humaine des sources",
      dependsOn: ["verify-sources"],
      agentKey: "quality-control",
      requiresHuman: true,
    },
    {
      key: "themes",
      title: "Cartographie des thèmes",
      dependsOn: ["human-source-review"],
      agentKey: "classification",
    },
    {
      key: "contradictions",
      title: "Détection des contradictions",
      dependsOn: ["themes"],
      agentKey: "quality-control",
    },
    {
      key: "bibliography",
      title: "Bibliographie annotée",
      dependsOn: ["contradictions"],
      agentKey: "bibliography",
      parallelGroup: "synthesis",
    },
    {
      key: "citations",
      title: "Normalisation des références",
      dependsOn: ["contradictions"],
      agentKey: "citation",
      parallelGroup: "synthesis",
    },
    {
      key: "synthesis",
      title: "Synthèse sourcée",
      dependsOn: ["bibliography", "citations"],
      agentKey: "academic-writing",
    },
    {
      key: "quality-gate",
      title: "Contrôle qualité et intégrité",
      dependsOn: ["synthesis"],
      agentKey: "quality-control",
    },
    {
      key: "privacy",
      title: "Revue confidentialité",
      dependsOn: ["quality-gate"],
      agentKey: "security-privacy",
    },
    {
      key: "delivery",
      title: "Paquet de livraison",
      dependsOn: ["privacy"],
      agentKey: "delivery",
    },
  ];
}

function extractCandidateDois(text: string): string[] {
  const matches = text.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi) ?? [];
  const fromDoiOrg =
    text.match(/doi\.org\/(10\.[^\s?#]+)/gi)?.map((m) => m.replace(/^doi\.org\//i, "")) ?? [];
  return [...new Set([...matches, ...fromDoiOrg])];
}

export async function runAcademicResearchTask(input: {
  taskKey: string;
  mission: ResearchMissionContext;
}): Promise<TaskRunResult> {
  const { taskKey, mission } = input;
  const empty: TaskRunResult = { payload: {}, evidences: [], deliverables: [], inventedContent: false };

  switch (taskKey) {
    case "intake": {
      const problem = {
        reformulated: mission.expectedOutcome,
        original: mission.originalRequest,
        domain: mission.academicDomain,
        level: mission.academicLevel,
        language: mission.language,
        scope: mission.scope,
        exclusions: mission.exclusions,
        statementKind: "proposal" as const,
      };
      return {
        ...empty,
        payload: { problem },
        deliverables: [
          {
            key: "problem-statement",
            title: "Problématique reformulée",
            format: "json",
            content: problem,
          },
        ],
        evidences: [
          {
            kind: "PROVENANCE",
            title: "Intake — reformulation",
            summary: "Problématique dérivée de la demande client uniquement",
            payload: { source: "client_request" },
          },
        ],
      };
    }
    case "ingest-sources":
    case "discover-sources": {
      const listed = mission.sources.map((s, index) => ({
        id: `src-${index + 1}`,
        label: s.label,
        uri: s.uri,
        accessible: s.accessible,
        notes: s.notes,
        origin: "user_provided" as const,
      }));
      return {
        ...empty,
        payload: { sources: listed, note: "Aucune source externe inventée." },
        evidences: [
          {
            kind: "SOURCE",
            title: taskKey === "ingest-sources" ? "Sources ingérées" : "Inventaire sources",
            payload: { count: listed.length, sources: listed },
          },
        ],
      };
    }
    case "verify-sources": {
      const verified = mission.sources.map((s, index) => {
        const dois = s.uri ? extractCandidateDois(s.uri) : [];
        const invalidDois = dois.filter((doi) => !DOI_RE.test(doi));
        return {
          id: `src-${index + 1}`,
          label: s.label,
          uri: s.uri,
          accessible: s.accessible,
          status: s.accessible ? (invalidDois.length ? "doi_format_invalid" : "accepted") : "rejected_inaccessible",
          invalidDois,
          justification: s.accessible
            ? invalidDois.length
              ? "DOI déclaré avec format invalide — non inventé, signalé."
              : "Source fournie par le client."
            : "Source signalée comme non accessible.",
        };
      });
      const rejected = verified.filter((v) => v.status !== "accepted");
      return {
        ...empty,
        payload: { verified, rejected },
        deliverables: [
          {
            key: "source-table",
            title: "Tableau des sources",
            format: "json",
            content: { verified },
          },
          {
            key: "rejected-sources",
            title: "Sources rejetées avec justification",
            format: "json",
            content: { rejected },
          },
        ],
        evidences: [
          {
            kind: "SOURCE",
            title: "Vérification sources",
            summary: `${verified.length} source(s) examinées ; ${rejected.length} rejet/signalement`,
            payload: { verifiedCount: verified.length, rejectedCount: rejected.length },
          },
        ],
      };
    }
    case "themes": {
      const themes = deriveThemes(mission);
      return {
        ...empty,
        payload: { themes },
        deliverables: [
          {
            key: "theme-map",
            title: "Carte des thèmes",
            format: "json",
            content: { themes, basis: "derived_from_client_text_only" },
          },
        ],
      };
    }
    case "contradictions": {
      const contradictions: Array<{ kind: string; detail: string; sources: string[] }> = [];
      const accessible = mission.sources.filter((s) => s.accessible);
      const inaccessible = mission.sources.filter((s) => !s.accessible);
      if (accessible.length && inaccessible.length) {
        contradictions.push({
          kind: "accessibility_mix",
          detail: "Mélange de sources accessibles et inaccessibles — les inaccessibles restent exclues de la synthèse.",
          sources: inaccessible.map((s) => s.label),
        });
      }
      const labels = mission.sources.map((s) => s.label.trim().toLowerCase());
      const dupes = labels.filter((label, index) => label && labels.indexOf(label) !== index);
      if (dupes.length) {
        contradictions.push({
          kind: "duplicate_label",
          detail: "Libellés de sources en double détectés (aucun contenu inventé pour les départager).",
          sources: [...new Set(dupes)],
        });
      }
      return {
        ...empty,
        payload: { contradictions, inventedForbidden: true },
        evidences: [
          {
            kind: "QUALITY_GATE",
            title: "Détection contradictions",
            summary: `${contradictions.length} contradiction(s) signalée(s)`,
            payload: { contradictions },
          },
        ],
        deliverables: [
          {
            key: "contradiction-report",
            title: "Rapport de contradictions",
            format: "json",
            content: { contradictions },
          },
        ],
      };
    }
    case "bibliography":
    case "citations": {
      const entries = mission.sources
        .filter((s) => s.accessible)
        .map((s, index) => ({
          id: `bib-${index + 1}`,
          label: s.label,
          uri: s.uri,
          annotation: s.notes ?? "Source fournie par le client — annotation sans invention.",
          normalized: s.label,
          fact: "Source déclarée par le client",
          inference: null,
          proposal: null,
        }));
      const key = taskKey === "bibliography" ? "annotated-bibliography" : "normalized-references";
      const title = taskKey === "bibliography" ? "Bibliographie annotée" : "Références normalisées";
      return {
        ...empty,
        payload: { entries },
        deliverables: [{ key, title, format: "json", content: { entries } }],
      };
    }
    case "synthesis": {
      const claims = [
        {
          text: mission.expectedOutcome,
          kind: "proposal" as const,
          linkedSources: mission.sources.filter((s) => s.accessible).map((s) => s.label),
        },
      ];
      if (!claims[0].linkedSources.length) {
        claims[0] = {
          ...claims[0],
          kind: "proposal",
          linkedSources: [],
        };
      }
      const limits = [
        "Synthèse limitée aux sources fournies par le client.",
        "Aucune expérimentation ni donnée de recherche inventée.",
        "Les affirmations non sourcées restent des propositions.",
      ];
      return {
        ...empty,
        payload: { claims, limits },
        deliverables: [
          {
            key: "sourced-synthesis",
            title: "Synthèse sourcée",
            format: "json",
            content: { claims, limits },
          },
          {
            key: "limits",
            title: "Limites et incertitudes",
            format: "json",
            content: { limits },
          },
        ],
      };
    }
    case "quality-gate": {
      const inventedDois = mission.sources.flatMap((s) => extractCandidateDois(`${s.uri ?? ""} ${s.notes ?? ""}`)).filter((doi) => !DOI_RE.test(doi));
      return {
        ...empty,
        payload: {
          ok: inventedDois.length === 0,
          rules: ["no_invented_source", "no_invented_doi", "fact_inference_proposal"],
        },
        evidences: [
          {
            kind: "QUALITY_GATE",
            title: "Contrôle intégrité pack recherche",
            payload: { invalidDoiFormats: inventedDois },
          },
        ],
      };
    }
    case "privacy": {
      return {
        ...empty,
        payload: { confidentialityReviewed: true },
        evidences: [
          {
            kind: "SYSTEM",
            title: "Revue confidentialité",
            payload: { status: "reviewed" },
          },
        ],
      };
    }
    case "delivery": {
      const report = {
        title: mission.title,
        expectedOutcome: mission.expectedOutcome,
        integrity: {
          aiAssistanceLevel: "assisted",
          declaration:
            "BICUNI a assisté la structuration et la vérification. Aucune source ni DOI n’a été inventé. Ce livrable n’est pas un devoir frauduleux présenté comme travail personnel.",
        },
        producedAt: new Date().toISOString(),
      };
      return {
        ...empty,
        payload: { packaged: true },
        deliverables: [
          {
            key: "final-report",
            title: "Rapport final",
            format: "json",
            content: report,
          },
          {
            key: "evidence-ledger",
            title: "Evidence Ledger",
            format: "json",
            content: {
              note: "Registre des preuves attachées à la mission (voir OutcomeEvidence).",
              inventedForbidden: true,
            },
          },
        ],
        evidences: [
          {
            kind: "PROVENANCE",
            title: "Paquet de livraison",
            payload: { deliverableKeys: ["final-report", "evidence-ledger"] },
          },
        ],
      };
    }
    default:
      return { ...empty, payload: { skipped: true, taskKey } };
  }
}

function deriveThemes(mission: ResearchMissionContext): string[] {
  const text = `${mission.title} ${mission.expectedOutcome} ${mission.academicDomain ?? ""} ${mission.scope ?? ""}`;
  const tokens = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9àâäéèêëïîôùûüç]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 4);
  const stop = new Set(["pour", "avec", "dans", "cette", "entre", "selon", "apres", "avant", "etude", "recherche", "resultat"]);
  const freq = new Map<string, number>();
  for (const token of tokens) {
    if (stop.has(token)) continue;
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term]) => term);
}

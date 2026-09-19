/**
 * Registre des agents OaaS.
 * executorKind est la vérité opérationnelle — `available` ne peut être true
 * que pour DETERMINISTIC_LOCAL ou REAL_EXECUTOR.
 */

export type AgentExecutorKind =
  | "REAL_EXECUTOR"
  | "DETERMINISTIC_LOCAL"
  | "ADAPTER_NOT_CONFIGURED"
  | "STUB_FORBIDDEN"
  | "DISABLED";

export type AgentDefinition = {
  key: string;
  name: string;
  specialty: string;
  version: string;
  tools: string[];
  permissions: string[];
  allowedSources: string[];
  costPerTaskCents: number;
  confidenceLevel: "low" | "medium" | "high";
  /** Capacité réelle d’exécution — jamais simulée silencieusement. */
  executorKind: AgentExecutorKind;
};

/** Agents effectivement câblés dans la tranche « Recherche académique vérifiée ». */
const ACADEMIC_SLICE_KEYS = new Set([
  "research-intake",
  "document-ingestion",
  "source-discovery",
  "source-verification",
  "quality-control",
  "classification",
  "bibliography",
  "citation",
  "academic-writing",
  "security-privacy",
  "delivery",
]);

export const AGENT_REGISTRY: readonly AgentDefinition[] = [
  {
    key: "research-intake",
    name: "Research Intake Agent",
    specialty: "Qualification et structuration de la demande",
    version: "1.1.0",
    tools: ["mission.parse", "criteria.extract"],
    permissions: ["mission:read", "mission:qualify"],
    allowedSources: ["user_provided"],
    costPerTaskCents: 0,
    confidenceLevel: "high",
    executorKind: "DETERMINISTIC_LOCAL",
  },
  {
    key: "source-discovery",
    name: "Source Discovery Agent",
    specialty: "Inventaire des sources fournies et candidates",
    version: "1.1.0",
    tools: ["sources.list", "sources.flag_inaccessible"],
    permissions: ["sources:read"],
    allowedSources: ["user_provided", "declared_external"],
    costPerTaskCents: 0,
    confidenceLevel: "medium",
    executorKind: "DETERMINISTIC_LOCAL",
  },
  {
    key: "source-verification",
    name: "Source Verification Agent",
    specialty: "Vérification d’accessibilité et de cohérence des sources",
    version: "1.1.0",
    tools: ["sources.verify", "doi.check_format"],
    permissions: ["sources:verify"],
    allowedSources: ["user_provided", "declared_external"],
    costPerTaskCents: 0,
    confidenceLevel: "high",
    executorKind: "DETERMINISTIC_LOCAL",
  },
  {
    key: "document-ingestion",
    name: "Document Ingestion Agent",
    specialty: "Ingestion et réservation des documents mission",
    version: "1.1.0",
    tools: ["documents.bind"],
    permissions: ["documents:read"],
    allowedSources: ["user_provided"],
    costPerTaskCents: 0,
    confidenceLevel: "high",
    executorKind: "DETERMINISTIC_LOCAL",
  },
  {
    key: "ocr",
    name: "OCR Agent",
    specialty: "Extraction textuelle de documents scannés",
    version: "1.0.0",
    tools: ["ocr.extract"],
    permissions: ["documents:read"],
    allowedSources: ["user_provided"],
    costPerTaskCents: 0,
    confidenceLevel: "medium",
    executorKind: "ADAPTER_NOT_CONFIGURED",
  },
  {
    key: "classification",
    name: "Classification Agent",
    specialty: "Classification thématique",
    version: "1.1.0",
    tools: ["themes.map"],
    permissions: ["mission:analyze"],
    allowedSources: ["user_provided"],
    costPerTaskCents: 0,
    confidenceLevel: "medium",
    executorKind: "DETERMINISTIC_LOCAL",
  },
  {
    key: "metadata",
    name: "Metadata Agent",
    specialty: "Normalisation des métadonnées",
    version: "1.0.0",
    tools: ["metadata.normalize"],
    permissions: ["mission:analyze"],
    allowedSources: ["user_provided"],
    costPerTaskCents: 0,
    confidenceLevel: "high",
    executorKind: "DISABLED",
  },
  {
    key: "citation",
    name: "Citation Agent",
    specialty: "Normalisation des citations",
    version: "1.1.0",
    tools: ["citations.normalize"],
    permissions: ["citations:write"],
    allowedSources: ["user_provided", "verified_only"],
    costPerTaskCents: 0,
    confidenceLevel: "high",
    executorKind: "DETERMINISTIC_LOCAL",
  },
  {
    key: "bibliography",
    name: "Bibliography Agent",
    specialty: "Bibliographie annotée",
    version: "1.1.0",
    tools: ["bibliography.build"],
    permissions: ["citations:write"],
    allowedSources: ["verified_only"],
    costPerTaskCents: 0,
    confidenceLevel: "high",
    executorKind: "DETERMINISTIC_LOCAL",
  },
  {
    key: "academic-writing",
    name: "Academic Writing Assistant",
    specialty: "Synthèse sourcée et reformulation",
    version: "1.1.0",
    tools: ["writing.synthesize"],
    permissions: ["deliverable:draft"],
    allowedSources: ["verified_only"],
    costPerTaskCents: 0,
    confidenceLevel: "medium",
    executorKind: "DETERMINISTIC_LOCAL",
  },
  {
    key: "translation",
    name: "Translation Agent",
    specialty: "Traduction académique assistée",
    version: "1.0.0",
    tools: ["translate"],
    permissions: ["deliverable:draft"],
    allowedSources: ["user_provided"],
    costPerTaskCents: 0,
    confidenceLevel: "medium",
    executorKind: "ADAPTER_NOT_CONFIGURED",
  },
  {
    key: "editorial",
    name: "Editorial Agent",
    specialty: "Préparation éditoriale",
    version: "1.0.0",
    tools: ["editorial.prepare"],
    permissions: ["deliverable:draft"],
    allowedSources: ["verified_only"],
    costPerTaskCents: 0,
    confidenceLevel: "medium",
    executorKind: "DISABLED",
  },
  {
    key: "pid",
    name: "PID Agent",
    specialty: "Attribution d’identifiants pérennes BICUNI",
    version: "1.0.0",
    tools: ["pid.assign"],
    permissions: ["pid:manage"],
    allowedSources: ["system"],
    costPerTaskCents: 0,
    confidenceLevel: "high",
    executorKind: "ADAPTER_NOT_CONFIGURED",
  },
  {
    key: "archive",
    name: "Archive Agent",
    specialty: "Archivage et conservation",
    version: "1.0.0",
    tools: ["archive.store"],
    permissions: ["documents:archive"],
    allowedSources: ["user_provided", "system"],
    costPerTaskCents: 0,
    confidenceLevel: "high",
    executorKind: "ADAPTER_NOT_CONFIGURED",
  },
  {
    key: "quality-control",
    name: "Quality Control Agent",
    specialty: "Quality Gate et contrôles d’intégrité",
    version: "1.1.0",
    tools: ["quality.gate", "integrity.check"],
    permissions: ["quality:run"],
    allowedSources: ["all_mission"],
    costPerTaskCents: 0,
    confidenceLevel: "high",
    executorKind: "DETERMINISTIC_LOCAL",
  },
  {
    key: "security-privacy",
    name: "Security and Privacy Agent",
    specialty: "Contrôles de confidentialité",
    version: "1.1.0",
    tools: ["privacy.review"],
    permissions: ["privacy:review"],
    allowedSources: ["all_mission"],
    costPerTaskCents: 0,
    confidenceLevel: "high",
    executorKind: "DETERMINISTIC_LOCAL",
  },
  {
    key: "delivery",
    name: "Delivery Agent",
    specialty: "Paquet de livraison",
    version: "1.1.0",
    tools: ["delivery.package"],
    permissions: ["deliverable:publish"],
    allowedSources: ["system"],
    costPerTaskCents: 0,
    confidenceLevel: "high",
    executorKind: "DETERMINISTIC_LOCAL",
  },
] as const;

export function getAgentDefinition(key: string) {
  return AGENT_REGISTRY.find((agent) => agent.key === key) ?? null;
}

export function isAgentExecutable(agent: Pick<AgentDefinition, "executorKind">): boolean {
  return agent.executorKind === "DETERMINISTIC_LOCAL" || agent.executorKind === "REAL_EXECUTOR";
}

export function agentAvailableFlag(agent: Pick<AgentDefinition, "executorKind">): boolean {
  return isAgentExecutable(agent);
}

/** Libellé UI honnête — jamais « IA active » pour un déterministe ou un adaptateur. */
export function formatExecutorKindLabel(kind: AgentExecutorKind): string {
  switch (kind) {
    case "DETERMINISTIC_LOCAL":
      return "Exécuteur local déterministe";
    case "ADAPTER_NOT_CONFIGURED":
      return "Adaptateur non configuré";
    case "DISABLED":
      return "Fonction désactivée";
    case "REAL_EXECUTOR":
      return "Exécuteur externe réel";
    case "STUB_FORBIDDEN":
      return "Stub interdit";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Ligne d’affichage mission : type d’exécuteur + disponible aligné sur la vérité registre. */
export function formatAgentAvailabilityLine(agentKey: string): string {
  const def = getAgentDefinition(agentKey);
  const kind = def?.executorKind;
  const available = def ? agentAvailableFlag(def) : false;
  const typeLabel = kind ? formatExecutorKindLabel(kind) : "Type d’exécuteur inconnu";
  return `type=${typeLabel} · disponible=${available ? "oui" : "non"}`;
}

export function assertAgentCanExecute(agentKey: string): AgentDefinition {
  const agent = getAgentDefinition(agentKey);
  if (!agent) {
    throw new Error(`Agent inconnu : ${agentKey}`);
  }
  if (!isAgentExecutable(agent)) {
    throw new Error(
      `Agent ${agentKey} non exécutable (${agent.executorKind}). Aucun faux résultat ne sera produit.`,
    );
  }
  return agent;
}

export function isAcademicSliceAgent(key: string): boolean {
  return ACADEMIC_SLICE_KEYS.has(key);
}

/** Stripe one-shot OaaS : adaptateur non branché dans ce lot. */
export const STRIPE_OAAS_STATUS = "ADAPTER_NOT_CONFIGURED" as const;

/** Interdits absolus pour tout agent BICUNI. */
export const AGENT_HARD_PROHIBITIONS = [
  "fabricate_reference",
  "invent_author",
  "invent_publication",
  "falsify_doi",
  "falsify_bicuni_pid",
  "invent_research_data",
  "present_hypothesis_as_fact",
  "publish_without_permission",
  "sign_as_client",
  "bypass_academic_integrity",
] as const;

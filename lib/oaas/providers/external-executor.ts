import { createHash, randomUUID } from "node:crypto";
import type {
  ExternalAiExecutor,
  ExternalExecutorCapabilities,
  ExternalExecutorRequest,
  ExternalExecutorResult,
  ExternalProviderId,
} from "@/lib/oaas/providers/types";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 2;

export type ExternalExecutorConfig = {
  /** Master kill switch — when true, every call fails closed as DISABLED. */
  killSwitch?: boolean;
  provider?: ExternalProviderId;
  /** Secret present? Never pass the raw secret into logs. */
  apiKeyConfigured?: boolean;
  modelVersion?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Remaining USD budget for the period; null = unlimited (not recommended). */
  budgetRemainingUsd?: number | null;
  /** When true, circuit is open until reset. */
  circuitOpen?: boolean;
};

function resolveConfig(overrides?: ExternalExecutorConfig): Required<
  Pick<
    ExternalExecutorConfig,
    "killSwitch" | "provider" | "apiKeyConfigured" | "timeoutMs" | "maxRetries" | "circuitOpen"
  >
> & {
  modelVersion: string | null;
  budgetRemainingUsd: number | null;
} {
  const envProvider = (process.env.OAAS_EXTERNAL_PROVIDER?.trim().toLowerCase() ||
    "none") as ExternalProviderId;
  const provider = overrides?.provider ?? (["openai", "anthropic", "gemini_vertex", "none"].includes(envProvider)
    ? envProvider
    : "none");
  const apiKeyConfigured =
    overrides?.apiKeyConfigured ??
    Boolean(process.env.OAAS_EXTERNAL_EXECUTOR_SECRET?.trim() || process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim());
  const killSwitch =
    overrides?.killSwitch ??
    (process.env.OAAS_EXTERNAL_EXECUTOR_KILL_SWITCH === "1" ||
      process.env.OAAS_EXTERNAL_EXECUTOR_ENABLED !== "1");

  return {
    killSwitch,
    provider,
    apiKeyConfigured,
    modelVersion: overrides?.modelVersion ?? process.env.OAAS_EXTERNAL_MODEL_VERSION?.trim() ?? null,
    timeoutMs: overrides?.timeoutMs ?? positiveInt(process.env.OAAS_EXTERNAL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxRetries: overrides?.maxRetries ?? positiveInt(process.env.OAAS_EXTERNAL_MAX_RETRIES, DEFAULT_MAX_RETRIES),
    budgetRemainingUsd:
      overrides?.budgetRemainingUsd === undefined
        ? optionalNumber(process.env.OAAS_EXTERNAL_BUDGET_USD)
        : overrides.budgetRemainingUsd,
    circuitOpen: overrides?.circuitOpen ?? process.env.OAAS_EXTERNAL_CIRCUIT_OPEN === "1",
  };
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function optionalNumber(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Redact common secret-shaped strings from structured payloads before logging. */
export function redactSensitive(value: unknown): unknown {
  if (typeof value === "string") {
    if (/sk-(live|test)-[A-Za-z0-9]+/i.test(value)) return "[REDACTED_SECRET]";
    if (/Bearer\s+\S+/i.test(value)) return "[REDACTED_BEARER]";
    if (value.length > 8 && /api[_-]?key/i.test(value)) return "[REDACTED]";
    return value;
  }
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/secret|password|token|authorization|api[_-]?key/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSensitive(v);
      }
    }
    return out;
  }
  return value;
}

function executionLogId(request: ExternalExecutorRequest): string {
  const basis = `${request.missionId}:${request.taskKey}:${request.agentKey}:${randomUUID()}`;
  return createHash("sha256").update(basis).digest("hex").slice(0, 24);
}

export function createExternalAiExecutor(overrides?: ExternalExecutorConfig): ExternalAiExecutor {
  const cfg = () => resolveConfig(overrides);

  return {
    capabilities(): ExternalExecutorCapabilities {
      const c = cfg();
      let status: ExternalExecutorCapabilities["status"] = "ADAPTER_NOT_CONFIGURED";
      if (c.killSwitch || c.provider === "none") status = "DISABLED";
      else if (!c.apiKeyConfigured || !c.modelVersion) status = "ADAPTER_NOT_CONFIGURED";
      else if (c.circuitOpen) status = "CIRCUIT_OPEN";
      else if (c.budgetRemainingUsd !== null && c.budgetRemainingUsd <= 0) status = "BUDGET_EXCEEDED";
      else status = "READY";

      return {
        provider: c.provider,
        status,
        modelVersion: c.modelVersion,
        maxRetries: Math.min(c.maxRetries, 3),
        timeoutMs: c.timeoutMs,
        circuitOpen: c.circuitOpen,
        budgetRemainingUsd: c.budgetRemainingUsd,
        killSwitch: c.killSwitch,
      };
    },

    async execute(request: ExternalExecutorRequest): Promise<ExternalExecutorResult> {
      const caps = this.capabilities();
      const logId = executionLogId(request);
      // Touch redaction path so callers can safely journal input fingerprints.
      void redactSensitive(request.input);

      if (caps.status !== "READY") {
        return {
          ok: false,
          status: caps.status,
          code: caps.status,
          message:
            caps.status === "DISABLED"
              ? "Exécuteur IA externe désactivé (kill switch ou provider=none). Aucune réponse inventée."
              : caps.status === "CIRCUIT_OPEN"
                ? "Circuit breaker ouvert — exécuteur IA externe indisponible."
                : caps.status === "BUDGET_EXCEEDED"
                  ? "Budget IA externe épuisé."
                  : "Adaptateur IA externe non configuré. Aucune réponse inventée ne sera produite.",
          retryable: caps.status === "CIRCUIT_OPEN",
          executionLogId: logId,
        };
      }

      // Intentionally unimplemented until the owner selects a provider and supplies a key.
      // Returning ADAPTER_NOT_CONFIGURED (not a fabricated completion) keeps the system honest.
      return {
        ok: false,
        status: "ADAPTER_NOT_CONFIGURED",
        code: "PROVIDER_TRANSPORT_NOT_WIRED",
        message:
          `Provider « ${caps.provider} » sélectionné mais le transport réel n’est pas encore câblé. ` +
          "Aucune réponse IA ne sera inventée. Autorisation propriétaire + clé requises.",
        retryable: false,
        executionLogId: logId,
      };
    },
  };
}

/** Default singleton for app wiring — always safe (disabled unless explicitly enabled). */
export const defaultExternalAiExecutor = createExternalAiExecutor();

/**
 * Provider-agnostic external AI executor interface for BICUNI OaaS.
 *
 * Rules:
 * - Never simulate model answers.
 * - When disabled / unconfigured → ADAPTER_NOT_CONFIGURED.
 * - Secrets stay in env / Secret Manager; never log them.
 * - Owner must explicitly enable a provider + supply a key before REAL_EXECUTOR.
 */

export type ExternalExecutorStatus =
  | "DISABLED"
  | "ADAPTER_NOT_CONFIGURED"
  | "READY"
  | "CIRCUIT_OPEN"
  | "BUDGET_EXCEEDED"
  | "QUOTA_EXCEEDED";

export type ExternalProviderId = "none" | "openai" | "anthropic" | "gemini_vertex";

export type ExternalExecutorRequest = {
  agentKey: string;
  missionId: string;
  taskKey: string;
  /** Structured, already-redacted mission fragment. */
  input: Record<string, unknown>;
  /** ISO schema / zod description the provider must satisfy. */
  outputSchemaName: string;
  timeoutMs?: number;
};

export type ExternalExecutorSuccess = {
  ok: true;
  provider: ExternalProviderId;
  modelVersion: string;
  latencyMs: number;
  estimatedCostUsd: number;
  /** Structured payload already validated by the adapter. */
  output: Record<string, unknown>;
  executionLogId: string;
};

export type ExternalExecutorFailure = {
  ok: false;
  status: Exclude<ExternalExecutorStatus, "READY">;
  code: string;
  message: string;
  retryable: boolean;
  executionLogId: string;
};

export type ExternalExecutorResult = ExternalExecutorSuccess | ExternalExecutorFailure;

export type ExternalExecutorCapabilities = {
  provider: ExternalProviderId;
  status: ExternalExecutorStatus;
  modelVersion: string | null;
  maxRetries: number;
  timeoutMs: number;
  circuitOpen: boolean;
  budgetRemainingUsd: number | null;
  killSwitch: boolean;
};

export interface ExternalAiExecutor {
  capabilities(): ExternalExecutorCapabilities;
  /** Executes only when status === READY; otherwise returns ADAPTER_NOT_CONFIGURED / DISABLED. */
  execute(request: ExternalExecutorRequest): Promise<ExternalExecutorResult>;
}

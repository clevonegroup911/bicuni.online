import { afterEach, describe, expect, it } from "vitest";
import {
  createExternalAiExecutor,
  redactSensitive,
} from "@/lib/oaas/providers/external-executor";

const ENV_KEYS = [
  "OAAS_EXTERNAL_EXECUTOR_ENABLED",
  "OAAS_EXTERNAL_EXECUTOR_KILL_SWITCH",
  "OAAS_EXTERNAL_PROVIDER",
  "OAAS_EXTERNAL_EXECUTOR_SECRET",
  "OAAS_EXTERNAL_MODEL_VERSION",
  "OAAS_EXTERNAL_CIRCUIT_OPEN",
  "OAAS_EXTERNAL_BUDGET_USD",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
] as const;

const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
    delete saved[key];
  }
});

function stashEnv() {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

describe("external AI executor interface", () => {
  it("reste DISABLED par défaut sans simulation", async () => {
    stashEnv();
    const executor = createExternalAiExecutor();
    expect(executor.capabilities().status).toBe("DISABLED");
    const result = await executor.execute({
      agentKey: "academic-writing",
      missionId: "m-test",
      taskKey: "draft",
      input: { prompt: "ne pas inventer" },
      outputSchemaName: "AcademicDraft",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("DISABLED");
      expect(result.message).not.toMatch(/lorem|fake completion/i);
      expect(result.message).toMatch(/aucune réponse inventée/i);
    }
  });

  it("signale ADAPTER_NOT_CONFIGURED si activé sans clé", async () => {
    stashEnv();
    const executor = createExternalAiExecutor({
      killSwitch: false,
      provider: "openai",
      apiKeyConfigured: false,
      modelVersion: "gpt-test",
    });
    expect(executor.capabilities().status).toBe("ADAPTER_NOT_CONFIGURED");
    const result = await executor.execute({
      agentKey: "academic-writing",
      missionId: "m-test",
      taskKey: "draft",
      input: {},
      outputSchemaName: "AcademicDraft",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("ADAPTER_NOT_CONFIGURED");
  });

  it("n’invente pas de sortie même si READY de config (transport non câblé)", async () => {
    stashEnv();
    const executor = createExternalAiExecutor({
      killSwitch: false,
      provider: "anthropic",
      apiKeyConfigured: true,
      modelVersion: "claude-test",
      budgetRemainingUsd: 10,
      circuitOpen: false,
    });
    expect(executor.capabilities().status).toBe("READY");
    const result = await executor.execute({
      agentKey: "academic-writing",
      missionId: "m-test",
      taskKey: "draft",
      input: { text: "x" },
      outputSchemaName: "AcademicDraft",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PROVIDER_TRANSPORT_NOT_WIRED");
      expect(result.status).toBe("ADAPTER_NOT_CONFIGURED");
    }
  });

  it("respecte circuit breaker et budget", () => {
    stashEnv();
    expect(
      createExternalAiExecutor({
        killSwitch: false,
        provider: "gemini_vertex",
        apiKeyConfigured: true,
        modelVersion: "gemini-test",
        circuitOpen: true,
      }).capabilities().status,
    ).toBe("CIRCUIT_OPEN");
    expect(
      createExternalAiExecutor({
        killSwitch: false,
        provider: "gemini_vertex",
        apiKeyConfigured: true,
        modelVersion: "gemini-test",
        budgetRemainingUsd: 0,
      }).capabilities().status,
    ).toBe("BUDGET_EXCEEDED");
  });

  it("redacte les secrets dans les journaux structurés", () => {
    expect(redactSensitive({ authorization: "Bearer abc", nested: { api_key: "x" } })).toEqual({
      authorization: "[REDACTED]",
      nested: { api_key: "[REDACTED]" },
    });
  });
});

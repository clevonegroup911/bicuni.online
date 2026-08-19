import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { antivirusScanner } from "./antivirus-scanner";

const sample = {
  bucket: "test-only-bucket",
  objectKey: "users/x/file.pdf",
  generation: "42",
  checksum: "a".repeat(64),
  sizeBytes: 1024,
  mimeType: "application/pdf",
};

beforeEach(() => {
  vi.stubEnv("ANTIVIRUS_SCANNER_URL", "https://scanner.example/scan");
  vi.stubEnv("ANTIVIRUS_SCANNER_AUTHORIZATION", "Bearer test-only-token");
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("antivirusScanner", () => {
  it("transmet une référence GCS versionnée sans URL publique", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => cleanResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(antivirusScanner().scan(sample)).resolves.toMatchObject({ verdict: "clean", engine: "test-engine" });
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.headers).toMatchObject({ authorization: "Bearer test-only-token" });
    expect(JSON.parse(String(request?.body))).toEqual({
      object: { bucket: sample.bucket, objectKey: sample.objectKey, generation: sample.generation },
      checksum: { algorithm: "sha256", value: sample.checksum },
      sizeBytes: sample.sizeBytes,
      mimeType: sample.mimeType,
    });
    expect(String(request?.body)).not.toMatch(/https?:\/\//);
  });

  it("reste indisponible en production sans authentification", async () => {
    vi.stubEnv("ANTIVIRUS_SCANNER_AUTHORIZATION", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await antivirusScanner().scan(sample);
    expect(result).toMatchObject({ verdict: "unavailable", reason: "scanner_auth_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classe un timeout comme indisponible", async () => {
    vi.stubEnv("ANTIVIRUS_SCANNER_TIMEOUT_MS", "10");
    vi.stubGlobal("fetch", vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })));
    await expect(antivirusScanner().scan(sample)).resolves.toMatchObject({ verdict: "unavailable", reason: "scanner_timeout" });
  });

  it("refuse une réponse dont le schéma est invalide", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ verdict: "clean", clean: true }), { status: 200 })));
    await expect(antivirusScanner().scan(sample)).resolves.toMatchObject({ verdict: "unavailable", reason: "scanner_invalid_response" });
  });

  it("ne traite pas un verdict ambigu comme clean", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ verdict: "unknown", checksum: sample.checksum, engine: "test-engine" }), { status: 200 })));
    await expect(antivirusScanner().scan(sample)).resolves.toMatchObject({ verdict: "unavailable" });
  });

  it("accepte un verdict clean réel lié au checksum serveur", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => cleanResponse()));
    await expect(antivirusScanner().scan(sample)).resolves.toEqual({ verdict: "clean", engine: "test-engine" });
  });

  it.each(["infected", "rejected"] as const)("convertit le verdict %s en rejet", async (verdict) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ verdict, checksum: sample.checksum, engine: "test-engine" }), { status: 200 })));
    await expect(antivirusScanner().scan(sample)).resolves.toEqual({ verdict: "rejected", engine: "test-engine" });
  });
});

function cleanResponse() {
  return new Response(JSON.stringify({ verdict: "clean", checksum: sample.checksum, engine: "test-engine" }), { status: 200 });
}

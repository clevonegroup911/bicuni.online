import { z } from "zod";

export type AntivirusVerdict = "clean" | "rejected" | "unavailable";

export type AntivirusScanInput = {
  bucket: string;
  objectKey: string;
  generation?: string;
  checksum: string;
  sizeBytes: number;
  mimeType: string;
};

export type AntivirusScanResult = {
  verdict: AntivirusVerdict;
  engine: string;
  reason?: string;
};

export interface AntivirusScanner {
  readonly engine: string;
  scan(input: AntivirusScanInput): Promise<AntivirusScanResult>;
}

const scannerResponseSchema = z.object({
  verdict: z.enum(["clean", "infected", "rejected"]),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i),
  engine: z.string().trim().min(1).max(80),
}).strict();

class UnconfiguredAntivirusScanner implements AntivirusScanner {
  readonly engine = "unconfigured";
  constructor(private readonly reason = "scanner_not_configured") {}
  async scan(): Promise<AntivirusScanResult> {
    return { verdict: "unavailable", engine: this.engine, reason: this.reason };
  }
}

class HttpAntivirusScanner implements AntivirusScanner {
  readonly engine = "http";
  constructor(private readonly endpoint: string, private readonly authorization?: string) {}

  async scan(input: AntivirusScanInput): Promise<AntivirusScanResult> {
    const timeoutMs = positiveInteger(process.env.ANTIVIRUS_SCANNER_TIMEOUT_MS, 4_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(this.authorization ? { authorization: this.authorization } : {}),
        },
        body: JSON.stringify({
          object: {
            bucket: input.bucket,
            objectKey: input.objectKey,
            generation: input.generation ?? null,
          },
          checksum: { algorithm: "sha256", value: input.checksum },
          sizeBytes: input.sizeBytes,
          mimeType: input.mimeType,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return { verdict: "unavailable", engine: this.engine, reason: "scanner_http_error" };
      }
      const parsed = scannerResponseSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success || parsed.data.checksum.toLowerCase() !== input.checksum.toLowerCase()) {
        return { verdict: "unavailable", engine: this.engine, reason: "scanner_invalid_response" };
      }
      return {
        verdict: parsed.data.verdict === "clean" ? "clean" : "rejected",
        engine: parsed.data.engine,
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      return { verdict: "unavailable", engine: this.engine, reason: timedOut ? "scanner_timeout" : "scanner_unreachable" };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function antivirusScanner(): AntivirusScanner {
  const endpoint = process.env.ANTIVIRUS_SCANNER_URL?.trim();
  if (!endpoint) return new UnconfiguredAntivirusScanner();

  const authorization = validAuthorization(process.env.ANTIVIRUS_SCANNER_AUTHORIZATION);
  if (process.env.NODE_ENV === "production" && !authorization) {
    return new UnconfiguredAntivirusScanner("scanner_auth_not_configured");
  }

  try {
    const url = new URL(endpoint);
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol === "https:" || (url.protocol === "http:" && loopback)) {
      return new HttpAntivirusScanner(url.toString(), authorization);
    }
    return new UnconfiguredAntivirusScanner("scanner_endpoint_not_secure");
  } catch {
    return new UnconfiguredAntivirusScanner("scanner_endpoint_invalid");
  }
}

function validAuthorization(value: string | undefined) {
  const authorization = value?.trim();
  if (!authorization || authorization.length > 4096 || /[\r\n]/.test(authorization)) return undefined;
  return authorization;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

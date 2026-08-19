export type AntivirusVerdict = "clean" | "rejected" | "unavailable";

export type AntivirusScanInput = {
  objectKey: string;
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

class UnconfiguredAntivirusScanner implements AntivirusScanner {
  readonly engine = "unconfigured";
  async scan(): Promise<AntivirusScanResult> {
    return { verdict: "unavailable", engine: this.engine, reason: "scanner_not_configured" };
  }
}

class HttpAntivirusScanner implements AntivirusScanner {
  readonly engine = "http";
  constructor(private readonly endpoint: string) {}

  async scan(input: AntivirusScanInput): Promise<AntivirusScanResult> {
    const timeoutMs = Number(process.env.ANTIVIRUS_SCANNER_TIMEOUT_MS) || 4_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          checksum: input.checksum,
          sizeBytes: input.sizeBytes,
          mimeType: input.mimeType,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return { verdict: "unavailable", engine: this.engine, reason: "scanner_http_error" };
      }
      const body = await response.json().catch(() => null) as { verdict?: string } | null;
      if (body?.verdict === "clean" || body?.verdict === "rejected") {
        return { verdict: body.verdict, engine: this.engine };
      }
      return { verdict: "unavailable", engine: this.engine, reason: "scanner_invalid_response" };
    } catch {
      return { verdict: "unavailable", engine: this.engine, reason: "scanner_unreachable" };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function antivirusScanner(): AntivirusScanner {
  const endpoint = process.env.ANTIVIRUS_SCANNER_URL?.trim();
  if (!endpoint) return new UnconfiguredAntivirusScanner();
  try {
    const url = new URL(endpoint);
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol === "https:" || (url.protocol === "http:" && loopback)) {
      return new HttpAntivirusScanner(url.toString());
    }
    return new UnconfiguredAntivirusScanner();
  } catch {
    return new UnconfiguredAntivirusScanner();
  }
}

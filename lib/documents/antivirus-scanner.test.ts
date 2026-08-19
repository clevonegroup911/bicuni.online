import { afterEach, describe, expect, it, vi } from "vitest";
import { antivirusScanner } from "./antivirus-scanner";

const sample = {
  objectKey: "users/x/file.pdf",
  checksum: "a".repeat(64),
  sizeBytes: 1024,
  mimeType: "application/pdf",
};

afterEach(() => {
  delete process.env.ANTIVIRUS_SCANNER_URL;
  vi.unstubAllGlobals();
});

describe("antivirusScanner", () => {
  it("ne simule jamais un résultat propre lorsqu’aucun moteur n’est configuré", async () => {
    delete process.env.ANTIVIRUS_SCANNER_URL;
    const result = await antivirusScanner().scan(sample);
    expect(result.verdict).toBe("unavailable");
    expect(result.engine).toBe("unconfigured");
    expect(result.verdict).not.toBe("clean");
  });

  it("ignore une URL HTTP non loopback", async () => {
    process.env.ANTIVIRUS_SCANNER_URL = "http://scanner.example/scan";
    const result = await antivirusScanner().scan(sample);
    expect(result.engine).toBe("unconfigured");
    expect(result.verdict).toBe("unavailable");
  });

  it("ne traite pas une réponse HTTP ambiguë comme clean", async () => {
    process.env.ANTIVIRUS_SCANNER_URL = "https://scanner.example/scan";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ verdict: "ok", clean: true }), { status: 200 })));
    const result = await antivirusScanner().scan(sample);
    expect(result.verdict).toBe("unavailable");
    expect(result.verdict).not.toBe("clean");
  });
});

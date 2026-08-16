import { afterEach, describe, expect, it, vi } from "vitest";
import { authEmailTemplate, sendEmail } from "./service";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("email service", () => {
  it("échappe le contenu HTML", () => {
    expect(authEmailTemplate("<test>", "ok", "go", "https://bicuni.online/?x=\"bad\"")).not.toContain("<test>");
  });

  it("réessaie une erreur fournisseur transitoire", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "test@bicuni.online");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "email-test" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendEmail({ to: "recipient@example.test", subject: "Test", html: "<p>Test</p>" })).resolves.toEqual({ id: "email-test" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ne réessaie pas une erreur fournisseur permanente", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "test@bicuni.online");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendEmail({ to: "recipient@example.test", subject: "Test", html: "<p>Test</p>" }))
      .rejects.toThrow("Échec d’envoi email (400).");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("autorise un transport HTTP uniquement sur loopback pour le QA", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "test@bicuni.online");
    vi.stubEnv("RESEND_API_URL", "http://127.0.0.1:18089/emails");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "local-test" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendEmail({ to: "recipient@example.test", subject: "Test", html: "<p>Test</p>" }))
      .resolves.toEqual({ id: "local-test" });
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:18089/emails", expect.any(Object));
  });

  it("refuse un transport HTTP non loopback", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "test@bicuni.online");
    vi.stubEnv("RESEND_API_URL", "http://email.example.test/emails");
    await expect(sendEmail({ to: "recipient@example.test", subject: "Test", html: "<p>Test</p>" }))
      .rejects.toThrow(/HTTPS ou un loopback HTTP/);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicOrigin } from "./public-origin";

beforeEach(() => {
  vi.stubEnv("PUBLIC_APP_URL", "");
  vi.stubEnv("AUTH_URL", "");
  vi.stubEnv("APP_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("publicOrigin", () => {
  it("donne priorité à PUBLIC_APP_URL", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://app.bicuni.online/path");
    vi.stubEnv("AUTH_URL", "https://auth.bicuni.online");
    expect(publicOrigin(new Request("https://attacker.example/api"))).toBe("https://app.bicuni.online");
  });
  it("utilise l’origine configurée sans conserver de chemin", () => {
    vi.stubEnv("AUTH_URL", "https://bicuni.online/auth/");
    expect(publicOrigin(new Request("https://attacker.example/api"))).toBe("https://bicuni.online");
  });

  it("n’accorde pas sa confiance au Host en production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(publicOrigin(new Request("https://attacker.example/api"))).toBe("https://bicuni.online");
  });

  it("refuse HTTP en production", () => {
    vi.stubEnv("AUTH_URL", "http://bicuni.online");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => publicOrigin(new Request("https://bicuni.online/api"))).toThrow(/HTTPS/);
  });

  it("autorise HTTP uniquement sur loopback pour les smoke tests du build", () => {
    vi.stubEnv("AUTH_URL", "http://127.0.0.1:3100");
    vi.stubEnv("NODE_ENV", "production");
    expect(publicOrigin(new Request("http://127.0.0.1:3100/api"))).toBe("http://127.0.0.1:3100");
  });
});

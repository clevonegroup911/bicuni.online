import { afterEach, describe, expect, it, vi } from "vitest";
import { publicOrigin } from "./public-origin";

const original = {
  authUrl: process.env.AUTH_URL,
  appUrl: process.env.APP_URL,
};

afterEach(() => {
  restore("AUTH_URL", original.authUrl);
  restore("APP_URL", original.appUrl);
  vi.unstubAllEnvs();
});

describe("publicOrigin", () => {
  it("utilise l’origine configurée sans conserver de chemin", () => {
    process.env.AUTH_URL = "https://bicuni.online/auth/";
    expect(publicOrigin(new Request("https://attacker.example/api"))).toBe("https://bicuni.online");
  });

  it("n’accorde pas sa confiance au Host en production", () => {
    delete process.env.AUTH_URL;
    delete process.env.APP_URL;
    vi.stubEnv("NODE_ENV", "production");
    expect(publicOrigin(new Request("https://attacker.example/api"))).toBe("https://bicuni.online");
  });

  it("refuse HTTP en production", () => {
    process.env.AUTH_URL = "http://bicuni.online";
    vi.stubEnv("NODE_ENV", "production");
    expect(() => publicOrigin(new Request("https://bicuni.online/api"))).toThrow(/HTTPS/);
  });

  it("autorise HTTP uniquement sur loopback pour les smoke tests du build", () => {
    process.env.AUTH_URL = "http://127.0.0.1:3100";
    vi.stubEnv("NODE_ENV", "production");
    expect(publicOrigin(new Request("http://127.0.0.1:3100/api"))).toBe("http://127.0.0.1:3100");
  });
});

function restore(key: "AUTH_URL" | "APP_URL", value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

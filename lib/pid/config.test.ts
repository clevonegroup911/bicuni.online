import { afterEach, describe, expect, it } from "vitest";
import { assertPidRuntimeConfig, buildResolverUrl, pidPrefix, pidScheme, publicAppUrl } from "./config";
import { PersistentIdentifierError } from "./errors";

const original = {
  prefix: process.env.BICUNI_PID_PREFIX,
  scheme: process.env.BICUNI_PID_SCHEME,
  appUrl: process.env.APP_URL,
};

function restoreEnv(key: "BICUNI_PID_PREFIX" | "BICUNI_PID_SCHEME" | "APP_URL", value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  restoreEnv("BICUNI_PID_PREFIX", original.prefix);
  restoreEnv("BICUNI_PID_SCHEME", original.scheme);
  restoreEnv("APP_URL", original.appUrl);
});

describe("configuration PID", () => {
  it("retombe sur bcu et BICUNI_PID", () => {
    delete process.env.BICUNI_PID_PREFIX;
    delete process.env.BICUNI_PID_SCHEME;
    delete process.env.APP_URL;
    expect(pidPrefix()).toBe("bcu");
    expect(pidScheme()).toBe("BICUNI_PID");
    expect(publicAppUrl()).toBe("https://bicuni.online");
  });

  it("accepte uniquement le préfixe interne bcu", () => {
    process.env.BICUNI_PID_PREFIX = "bcu";
    process.env.BICUNI_PID_SCHEME = "BICUNI_PID";
    expect(pidPrefix()).toBe("bcu");
    expect(pidScheme()).toBe("BICUNI_PID");
  });

  it("rejette BICUNI_PID_SCHEME=DOI de manière fail-closed", () => {
    process.env.BICUNI_PID_SCHEME = "DOI";
    expect(() => pidScheme()).toThrow(PersistentIdentifierError);
    expect(() => assertPidRuntimeConfig()).toThrow(/DOI/);
    expect(() => pidPrefix()).toThrow(PersistentIdentifierError);
  });

  it("rejette un préfixe 10.x ou 10.bcu", () => {
    delete process.env.BICUNI_PID_SCHEME;
    process.env.BICUNI_PID_PREFIX = "10.bcu";
    expect(() => pidPrefix()).toThrow(PersistentIdentifierError);
    process.env.BICUNI_PID_PREFIX = "10.12345";
    expect(() => assertPidRuntimeConfig()).toThrow(/préfixe/);
  });

  it("construit l’URL de résolution /pid depuis APP_URL", () => {
    process.env.APP_URL = "https://bicuni.online/";
    expect(buildResolverUrl("bcu/2026.art.01K2R8M7H7YV5A")).toBe(
      "https://bicuni.online/pid/bcu/2026.art.01K2R8M7H7YV5A",
    );
  });
});

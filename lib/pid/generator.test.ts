import { describe, expect, it } from "vitest";
import { generatePersistentIdentifier } from "./generator";

describe("génération d’identifiant pérenne", () => {
  it("suit le motif année.type.ulid", () => {
    const now = new Date("2026-08-13T10:00:00.000Z");
    const generated = generatePersistentIdentifier("ART", "resource", now);
    expect(generated.suffix).toMatch(/^2026\.art\.[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(generated.identifier).toBe(`${generated.prefix}/${generated.suffix}`);
  });

  it("utilise le préfixe interne bcu, pas un lookalike DOI", () => {
    const originalPrefix = process.env.BICUNI_PID_PREFIX;
    const originalScheme = process.env.BICUNI_PID_SCHEME;
    delete process.env.BICUNI_PID_PREFIX;
    delete process.env.BICUNI_PID_SCHEME;
    try {
      const generated = generatePersistentIdentifier("ART", undefined, new Date("2026-08-13T10:00:00.000Z"));
      expect(generated.prefix).toBe("bcu");
      expect(generated.identifier.startsWith("bcu/")).toBe(true);
      expect(generated.prefix.startsWith("10.")).toBe(false);
    } finally {
      if (originalPrefix === undefined) delete process.env.BICUNI_PID_PREFIX;
      else process.env.BICUNI_PID_PREFIX = originalPrefix;
      if (originalScheme === undefined) delete process.env.BICUNI_PID_SCHEME;
      else process.env.BICUNI_PID_SCHEME = originalScheme;
    }
  });

  it("refuse de générer si le schéma DOI est forcé par l’environnement", () => {
    const original = process.env.BICUNI_PID_SCHEME;
    process.env.BICUNI_PID_SCHEME = "DOI";
    try {
      expect(() => generatePersistentIdentifier("ART")).toThrow(/DOI/);
    } finally {
      if (original === undefined) delete process.env.BICUNI_PID_SCHEME;
      else process.env.BICUNI_PID_SCHEME = original;
    }
  });

  it("refuse DOCUMENT et PUBLICATION comme classification de suffixe", () => {
    expect(() => generatePersistentIdentifier("DOCUMENT" as never)).toThrow(/suffixType/);
    expect(() => generatePersistentIdentifier("PUBLICATION" as never)).toThrow(/suffixType/);
  });

  it("reste unique sur une série", () => {
    const now = new Date("2026-08-13T10:00:00.000Z");
    const values = new Set(Array.from({ length: 40 }, () => generatePersistentIdentifier("BOOK", undefined, now).identifier));
    expect(values.size).toBe(40);
  });
});

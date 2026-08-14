import { describe, expect, it } from "vitest";
import {
  adminPidHistoryQuerySchema,
  assertPidGenerationConfig,
  createPersistentIdentifierSchema,
  isForbiddenDoiLookalike,
  pidIdentifierSchema,
  pidPrefixSchema,
  pidSuffixSchema,
  updatePersistentIdentifierSchema,
  validatePidTargetUrl,
} from "./validators";
import { PersistentIdentifierError } from "./errors";
import { PID_SUFFIX_TYPES } from "./types";

const resourceId = "cm12345678901234567890123";
const targetUrl = `https://bicuni.online/documents/${resourceId}`;

describe("validation des identifiants", () => {
  it("accepte un identifiant BICUNI PID bien formé", () => {
    expect(pidIdentifierSchema.safeParse("bcu/2026.art.01K2R8M7H7YV5A0000000000").success).toBe(true);
  });

  it("rejette le lookalike DOI 10.bcu", () => {
    expect(pidPrefixSchema.safeParse("10.bcu").success).toBe(false);
    expect(pidIdentifierSchema.safeParse("10.bcu/2026.art.01K2R8M7H7YV5A0000000000").success).toBe(false);
    expect(isForbiddenDoiLookalike("10.bcu")).toBe(true);
  });

  it("rejette tout préfixe 10.x et 10.87878/bicuni", () => {
    expect(pidPrefixSchema.safeParse("10.12345").success).toBe(false);
    expect(pidIdentifierSchema.safeParse("10.12345/article.xxxxx").success).toBe(false);
    expect(pidIdentifierSchema.safeParse("10.87878/bicuni.doc-1").success).toBe(false);
    expect(isForbiddenDoiLookalike("10.87878/bicuni.doc-1")).toBe(true);
  });

  it("rejette un identifiant trop long avant toute logique métier", () => {
    expect(pidIdentifierSchema.safeParse(`bcu/${"a".repeat(200)}`).success).toBe(false);
    expect(pidSuffixSchema.safeParse("a".repeat(81)).success).toBe(false);
  });

  it("rejette un identifiant malformé", () => {
    expect(pidIdentifierSchema.safeParse("").success).toBe(false);
    expect(pidIdentifierSchema.safeParse("bcu").success).toBe(false);
    expect(pidIdentifierSchema.safeParse("bcu/").success).toBe(false);
    expect(pidIdentifierSchema.safeParse("bcu/../secret").success).toBe(false);
    expect(pidIdentifierSchema.safeParse("bcu/2026 art x").success).toBe(false);
    expect(pidSuffixSchema.safeParse("..%2e%2e").success).toBe(false);
  });

  it("refuse de générer un DOI ou un préfixe DOI", () => {
    expect(() => assertPidGenerationConfig("bcu", "DOI")).toThrow(PersistentIdentifierError);
    expect(() => assertPidGenerationConfig("10.bcu", "BICUNI_PID")).toThrow(PersistentIdentifierError);
    expect(() => assertPidGenerationConfig("10.1234", "BICUNI_PID")).toThrow(PersistentIdentifierError);
    expect(() => assertPidGenerationConfig("bcu", "BICUNI_PID")).not.toThrow();
  });
});

describe("validation des URL de destination", () => {
  it("accepte https://bicuni.online et les sous-domaines", () => {
    expect(validatePidTargetUrl("https://bicuni.online/documents/abc")).toBeNull();
    expect(validatePidTargetUrl("https://library.bicuni.online/item/1")).toBeNull();
  });

  it("rejette les protocoles et hôtes dangereux", () => {
    expect(validatePidTargetUrl("javascript:alert(1)")).toMatch(/interdit/);
    expect(validatePidTargetUrl("data:text/html,phishing")).toMatch(/interdit/);
    expect(validatePidTargetUrl("file:///etc/passwd")).toMatch(/interdit/);
    expect(validatePidTargetUrl("https://localhost/secret")).toMatch(/locale/);
    expect(validatePidTargetUrl("https://127.0.0.1/secret")).toMatch(/locale/);
    expect(validatePidTargetUrl("https://[::1]/secret")).toMatch(/locale/);
    expect(validatePidTargetUrl("https://evil.example/phishing")).toMatch(/non autorisé/);
    expect(validatePidTargetUrl("https://user:pass@bicuni.online/x")).toMatch(/identifiants/);
    expect(validatePidTargetUrl("not-a-url")).toMatch(/invalide/);
  });
});

describe("schémas administratifs", () => {
  it("refuse la modification de l’identifiant publié", () => {
    const result = updatePersistentIdentifierSchema.safeParse({
      action: "updateTarget",
      targetUrl: "https://bicuni.online/library/new",
      identifier: "bcu/tampered",
      prefix: "evil",
      suffix: "tampered",
    });
    expect(result.success).toBe(false);
  });

  it("accepte une création DOCUMENT avec suffixType académique", () => {
    const result = createPersistentIdentifierSchema.safeParse({
      resourceType: "document",
      suffixType: "article",
      resourceId,
      targetUrl,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resourceType).toBe("DOCUMENT");
      expect(result.data.suffixType).toBe("ART");
      expect(result.data.resourceId).toBe(resourceId);
    }
  });

  it("refuse resourceId absent, null, vide ou blanc", () => {
    expect(createPersistentIdentifierSchema.safeParse({
      resourceType: "DOCUMENT",
      suffixType: "ART",
      targetUrl,
    }).success).toBe(false);
    expect(createPersistentIdentifierSchema.safeParse({
      resourceType: "DOCUMENT",
      suffixType: "ART",
      resourceId: null,
      targetUrl,
    }).success).toBe(false);
    expect(createPersistentIdentifierSchema.safeParse({
      resourceType: "DOCUMENT",
      suffixType: "ART",
      resourceId: "",
      targetUrl,
    }).success).toBe(false);
    expect(createPersistentIdentifierSchema.safeParse({
      resourceType: "DOCUMENT",
      suffixType: "ART",
      resourceId: "   ",
      targetUrl,
    }).success).toBe(false);
    expect(createPersistentIdentifierSchema.safeParse({
      resourceType: "PUBLICATION",
      suffixType: "ART",
      resourceId: ` ${resourceId} `,
      targetUrl,
    }).success).toBe(false);
  });

  it("rejette ART, BOOK et THESIS comme resourceType", () => {
    expect(createPersistentIdentifierSchema.safeParse({ resourceType: "art", resourceId, targetUrl }).success).toBe(false);
    expect(createPersistentIdentifierSchema.safeParse({ resourceType: "ART", resourceId, targetUrl }).success).toBe(false);
    expect(createPersistentIdentifierSchema.safeParse({ resourceType: "book", resourceId, targetUrl }).success).toBe(false);
    expect(createPersistentIdentifierSchema.safeParse({ resourceType: "thesis", resourceId, targetUrl }).success).toBe(false);
  });

  it("rejette DOCUMENT et PUBLICATION comme suffixType", () => {
    expect(createPersistentIdentifierSchema.safeParse({
      resourceType: "DOCUMENT",
      suffixType: "DOCUMENT",
      resourceId,
      targetUrl,
    }).success).toBe(false);
    expect(createPersistentIdentifierSchema.safeParse({
      resourceType: "DOCUMENT",
      suffixType: "PUBLICATION",
      resourceId,
      targetUrl,
    }).success).toBe(false);
    expect(createPersistentIdentifierSchema.safeParse({
      resourceType: "PUBLICATION",
      suffixType: "publication",
      resourceId,
      targetUrl,
    }).success).toBe(false);
  });

  it("accepte uniquement les suffixType de PID_SUFFIX_TYPES", () => {
    for (const suffixType of PID_SUFFIX_TYPES) {
      expect(createPersistentIdentifierSchema.safeParse({
        resourceType: "DOCUMENT",
        suffixType,
        resourceId,
        targetUrl,
      }).success).toBe(true);
    }
    expect(createPersistentIdentifierSchema.safeParse({
      resourceType: "DOCUMENT",
      suffixType: "SOFTWARE",
      resourceId,
      targetUrl,
    }).success).toBe(false);
  });

  it("borne la pagination d’historique", () => {
    expect(adminPidHistoryQuerySchema.parse({}).limit).toBe(20);
    expect(adminPidHistoryQuerySchema.safeParse({ limit: 50 }).success).toBe(true);
    expect(adminPidHistoryQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });
});

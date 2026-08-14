import { describe, expect, it } from "vitest";
import { isSyntheticBicuniDoi, internalDoiForApproval, registeredDoi, SYNTHETIC_BICUNI_DOI_PREFIX } from "./doi";

describe("identifiants DOI", () => {
  it("masque le préfixe synthétique historiquement généré", () => {
    expect(isSyntheticBicuniDoi(`${SYNTHETIC_BICUNI_DOI_PREFIX}abc`)).toBe(true);
    expect(registeredDoi(`${SYNTHETIC_BICUNI_DOI_PREFIX}abc`)).toBeNull();
  });

  it("ne simule aucun DOI lorsque le champ est vide", () => {
    expect(registeredDoi(null)).toBeNull();
    expect(registeredDoi("")).toBeNull();
    expect(registeredDoi("   ")).toBeNull();
  });

  it("conserve un identifiant réellement stocké hors préfixe synthétique", () => {
    expect(registeredDoi("10.1234/example.real")).toBe("10.1234/example.real");
  });
});

describe("internalDoiForApproval", () => {
  it("synthetic DOI => null", () => {
    expect(internalDoiForApproval("10.87878/bicuni.doc-1")).toBeNull();
  });

  it("null => null", () => {
    expect(internalDoiForApproval(null)).toBeNull();
    expect(internalDoiForApproval(undefined)).toBeNull();
  });

  it("DOI réel => conservé", () => {
    expect(internalDoiForApproval("10.1234/example.real")).toBe("10.1234/example.real");
  });

  it("ne copie jamais un BICUNI PID dans internalDoi", () => {
    expect(internalDoiForApproval("bcu/2026.art.01K2R8M7H7YV5A0000000000")).toBeNull();
    expect(internalDoiForApproval("10.bcu/2026.art.01K2R8M7H7YV5A0000000000")).toBeNull();
  });
});

describe("séparation BICUNI PID / DOI", () => {
  it("n’expose jamais un PID interne comme DOI", () => {
    expect(registeredDoi("bcu/2026.art.01K2R8M7H7YV5A0000000000")).toBeNull();
    expect(registeredDoi("10.bcu/2026.art.01K2R8M7H7YV5A0000000000")).toBeNull();
  });
});

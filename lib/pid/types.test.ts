import { describe, expect, it } from "vitest";
import {
  isPidSuffixType,
  parsePidSuffixType,
  pidSuffixTypeFromDocumentType,
  PID_SUFFIX_TYPE_CODES,
  PID_SUFFIX_TYPES,
} from "./types";

describe("PID_SUFFIX_TYPES", () => {
  it("ne contient que les catégories académiques", () => {
    expect([...PID_SUFFIX_TYPES]).toEqual([
      "ART",
      "BOOK",
      "THESIS",
      "PAPER",
      "DATASET",
      "REPORT",
      "COURSE",
      "MEDIA",
    ]);
    expect(PID_SUFFIX_TYPES).not.toContain("DOCUMENT");
    expect(PID_SUFFIX_TYPES).not.toContain("PUBLICATION");
    expect(Object.keys(PID_SUFFIX_TYPE_CODES).sort()).toEqual([...PID_SUFFIX_TYPES].sort());
  });

  it("refuse DOCUMENT et PUBLICATION comme suffixType", () => {
    expect(parsePidSuffixType("DOCUMENT")).toBeNull();
    expect(parsePidSuffixType("PUBLICATION")).toBeNull();
    expect(parsePidSuffixType("document")).toBeNull();
    expect(parsePidSuffixType("publication")).toBeNull();
    expect(isPidSuffixType("DOCUMENT")).toBe(false);
    expect(isPidSuffixType("PUBLICATION")).toBe(false);
  });

  it("mappe DocumentType vers un suffixType académique", () => {
    expect(pidSuffixTypeFromDocumentType("ARTICLE")).toBe("ART");
    expect(pidSuffixTypeFromDocumentType("THESE")).toBe("THESIS");
    expect(pidSuffixTypeFromDocumentType("MEMOIRE")).toBe("THESIS");
    expect(pidSuffixTypeFromDocumentType("TFC")).toBe("PAPER");
    expect(pidSuffixTypeFromDocumentType("RAPPORT")).toBe("REPORT");
    expect(isPidSuffixType(pidSuffixTypeFromDocumentType("ARTICLE"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  flattenProfileErrors,
  parseResearchFields,
  PROFILE_API_CONTRACT,
  PROFILE_WRITE_PATH,
  safeImageUrl,
  valuesToPayload,
} from "./contract";

describe("contrat profil", () => {
  it("n’expose que PATCH /api/profile", () => {
    expect(PROFILE_WRITE_PATH).toBe("/api/profile");
    expect(PROFILE_API_CONTRACT.method).toBe("PATCH");
    expect(PROFILE_API_CONTRACT.notWritable).toContain("User.email");
    expect(PROFILE_API_CONTRACT.notWritable.join(" ")).toContain("facultyId");
  });

  it("accepte un profil public aligné sur Prisma", () => {
    const parsed = valuesToPayload({
      name: "Ada Lovelace",
      title: "Chercheuse",
      bio: "Mathématiques et machines.",
      country: "RD Congo",
      orcid: "0000-0002-1825-0097",
      website: "https://example.org",
      image: "https://example.org/ada.jpg",
      researchFields: "histoire, informatique",
      universityId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      facultyId: "should-not-be-sent",
      departmentId: "clyyyyyyyyyyyyyyyyyyyyyyyyy",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.researchFields).toEqual(["histoire", "informatique"]);
      expect(parsed.data).not.toHaveProperty("facultyId");
    }
  });

  it("refuse un ORCID invalide et un département orphelin", () => {
    const orcid = valuesToPayload({
      name: "Test",
      title: "",
      bio: "",
      country: "",
      orcid: "123",
      website: "",
      image: "",
      researchFields: "",
      universityId: "",
      facultyId: "",
      departmentId: "",
    });
    expect(orcid.success).toBe(false);
    if (!orcid.success) expect(flattenProfileErrors(orcid.error).orcid).toBeTruthy();

    const orphan = valuesToPayload({
      name: "Test",
      title: "",
      bio: "",
      country: "",
      orcid: "",
      website: "",
      image: "",
      researchFields: "",
      universityId: "",
      facultyId: "",
      departmentId: "clzzzzzzzzzzzzzzzzzzzzzzzzz",
    });
    expect(orphan.success).toBe(false);
  });

  it("sécurise l’URL d’avatar", () => {
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("//evil.example")).toBeNull();
    expect(safeImageUrl("/avatars/me.png")).toBe("/avatars/me.png");
    expect(safeImageUrl("https://cdn.example/a.png")).toBe("https://cdn.example/a.png");
  });

  it("déduplique les domaines de recherche", () => {
    expect(parseResearchFields(" ia , éducation, ia ")).toEqual(["ia", "éducation"]);
  });
});

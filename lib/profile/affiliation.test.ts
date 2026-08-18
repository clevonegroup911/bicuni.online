import { describe, expect, it } from "vitest";
import { departmentBelongsToUniversity, departmentsFor, facultyIdForDepartment } from "./affiliation";
import type { AffiliationTaxonomy } from "./contract";

const taxonomy: AffiliationTaxonomy = {
  universities: [
    {
      id: "uni-1",
      name: "Université TEST",
      faculties: [
        {
          id: "fac-1",
          name: "Sciences",
          departments: [{ id: "dep-1", name: "Informatique" }],
        },
      ],
    },
  ],
};

describe("affiliation profil", () => {
  it("dérive la faculté depuis le département, sans champ Prisma facultyId", () => {
    expect(facultyIdForDepartment(taxonomy, "uni-1", "dep-1")).toBe("fac-1");
    expect(departmentsFor(taxonomy, "uni-1", "fac-1")).toEqual([{ id: "dep-1", name: "Informatique" }]);
    expect(departmentBelongsToUniversity(taxonomy, "uni-1", "dep-1")).toBe(true);
  });

  it("refuse un département d’une autre université", () => {
    expect(facultyIdForDepartment(taxonomy, "uni-other", "dep-1")).toBe("");
    expect(departmentBelongsToUniversity(taxonomy, "uni-1", "dep-missing")).toBe(false);
  });
});

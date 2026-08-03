import { describe, expect, it } from "vitest";
import { can, ROLES } from "./rbac";

describe("RBAC", () => {
  it("couvre exactement les cinq rôles", () => {
    expect(ROLES).toEqual(["STUDENT", "RESEARCHER", "UNIVERSITY_ADMIN", "SUPER_ADMIN", "GOVERNMENT"]);
  });

  it("applique les permissions propres à chaque rôle", () => {
    expect(can("STUDENT", "document:create")).toBe(false);
    expect(can("RESEARCHER", "document:create")).toBe(true);
    expect(can("UNIVERSITY_ADMIN", "document:review")).toBe(true);
    expect(can("SUPER_ADMIN", "anything")).toBe(true);
    expect(can("GOVERNMENT", "analytics:national")).toBe(true);
    expect(can("GOVERNMENT", "document:review")).toBe(false);
  });
});

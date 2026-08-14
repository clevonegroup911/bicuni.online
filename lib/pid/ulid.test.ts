import { describe, expect, it } from "vitest";
import { generateUlid } from "./ulid";

describe("ULID", () => {
  it("produit 26 caractères Crockford et reste unique", () => {
    const values = new Set(Array.from({ length: 80 }, () => generateUlid(Date.UTC(2026, 7, 13))));
    expect([...values][0]).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(values.size).toBe(80);
  });
});

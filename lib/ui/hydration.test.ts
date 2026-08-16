import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("hydratation déterministe", () => {
  it("n’anime Reveal qu’après le montage client", () => {
    const source = readFileSync("components/ui/motion.tsx", "utf8");
    expect(source).toMatch(/useSyncExternalStore/);
    expect(source).toMatch(/serverSnapshot = \(\) => false/);
    expect(source).toMatch(/clientSnapshot = \(\) => true/);
    expect(source).toMatch(/if \(!ready \|\| reduced\)/);
    expect(source).not.toMatch(/initial=\{reduced/);
  });

  it("n’ajoute pas suppressHydrationWarning", () => {
    const files = [
      "components/ui/motion.tsx",
      "components/layout/header.tsx",
      "components/auth/login-form.tsx",
      "app/(site)/page.tsx",
      "app/(site)/login/page.tsx",
    ];
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/suppressHydrationWarning/);
    }
  });
});

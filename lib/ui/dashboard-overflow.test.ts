import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("layout dashboard anti-overflow", () => {
  const layout = readFileSync("app/layout.css", "utf8");
  const dashboard = readFileSync("app/dashboard.css", "utf8");
  const globals = readFileSync("app/globals.css", "utf8");

  it("contraint la grille et autorise un défilement interne de la nav", () => {
    expect(layout).toContain(".dashboard-layout{display:grid;grid-template-columns:245px minmax(0,1fr)");
    expect(layout).toContain("min-width:0");
    expect(layout).toContain(".dashboard-layout{grid-template-columns:minmax(0,1fr)}");
    expect(layout).toContain(".app-sidebar nav{display:flex;overflow-x:auto");
    expect(layout).not.toContain("overflow-x:hidden");
    expect(globals).toContain(".shell{width:min(1240px,calc(100% - 48px));margin-inline:auto;min-width:0}");
    expect(dashboard).toContain("grid-template-columns:minmax(0,1fr)");
  });
});

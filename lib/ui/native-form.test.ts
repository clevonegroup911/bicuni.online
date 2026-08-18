import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nativeFormNavigationUrl, urlExposesSecrets } from "./native-form";

const AUTH_FORMS = [
  ["components/auth/login-form.tsx", "/login"],
  ["components/auth/register-form.tsx", "/signup"],
  ["components/auth/forgot-password-form.tsx", "/forgot-password"],
  ["components/admin/admin-login-form.tsx", "/admin/login"],
] as const;

const SECRET_FIELDS = {
  email: "qa-secret@example.test",
  password: "SuperSecret-Login-2026",
};

describe("soumission native des formulaires Auth", () => {
  it("un GET placerait le mot de passe dans l’URL", () => {
    const url = nativeFormNavigationUrl({
      method: "get",
      pageUrl: "http://127.0.0.1:3000/login",
      fields: SECRET_FIELDS,
    });
    expect(url.searchParams.get("password")).toBe(SECRET_FIELDS.password);
    expect(urlExposesSecrets(url.href, [SECRET_FIELDS.password, SECRET_FIELDS.email])).toBe(true);
  });

  it.each(AUTH_FORMS)("%s publie en POST sans secret dans l’URL", (file, action) => {
    const source = readFileSync(file, "utf8");
    expect(source).toMatch(/method="post"/);
    expect(source).toMatch(new RegExp(`action="${action}"`));
    expect(source).toMatch(/event\.preventDefault\(\)/);
    expect(source).toMatch(/type="submit"/);
    expect(source).toMatch(/autoComplete="(email|username|current-password|new-password)"/);

    const url = nativeFormNavigationUrl({
      method: "post",
      action,
      pageUrl: `http://127.0.0.1:3000${action}?next=/dashboard`,
      fields: SECRET_FIELDS,
    });
    expect(url.searchParams.has("password")).toBe(false);
    expect(url.searchParams.has("email")).toBe(false);
    expect(urlExposesSecrets(url.href, Object.values(SECRET_FIELDS))).toBe(false);
    expect(url.pathname).toBe(action);
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const STAGING_DIR = join(process.cwd(), "infra", "staging");

const FORBIDDEN_EXACT = [
  "bicuni-online",
  "bicuni-postgres",
  "bicuni-storage-504414",
  "bicuni.online",
  "www.bicuni.online",
] as const;

/** Assignments that would make IaC manage a production resource. */
const FORBIDDEN_ASSIGNMENT =
  /(?:^|\n)\s*(?:name|bucket|instance|cloud_run_service_name|cloud_sql_instance_name|gcs_bucket_name|public_app_host)\s*=\s*"(bicuni-online|bicuni-postgres|bicuni-storage-504414|bicuni\.online|www\.bicuni\.online)"/g;

function listConfigFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".tf") || name.endsWith(".tfvars.example"))
    .map((name) => join(dir, name));
}

describe("staging IaC must not target production resources", () => {
  it("refuse les assignations de noms de production", () => {
    const files = listConfigFiles(STAGING_DIR);
    expect(files.length).toBeGreaterThan(5);

    const offenders: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      for (const match of raw.matchAll(FORBIDDEN_ASSIGNMENT)) {
        offenders.push(`${file} → ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("impose le préfixe staging sur les ressources critiques", () => {
    const tfvars = readFileSync(join(STAGING_DIR, "terraform.tfvars.example"), "utf8");
    expect(tfvars).toMatch(/cloud_run_service_name\s*=\s*"bicuni-staging"/);
    expect(tfvars).toMatch(/cloud_sql_instance_name\s*=\s*"bicuni-staging-postgres"/);
    expect(tfvars).toMatch(/gcs_bucket_name\s*=\s*"bicuni-staging-storage-504414"/);
    expect(tfvars).toMatch(/public_app_host\s*=\s*"staging\.bicuni\.online"/);
    for (const name of FORBIDDEN_EXACT) {
      expect(tfvars.includes(`"${name}"`)).toBe(false);
    }
  });

  it("documente l’interdiction d’apply dans le README", () => {
    const readme = readFileSync(join(STAGING_DIR, "README.md"), "utf8");
    expect(readme).toMatch(/Never run `terraform apply`/i);
  });
});

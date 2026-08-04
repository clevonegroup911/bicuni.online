import { initializeSuperAdmin } from "../lib/admin/bootstrap";
import { db } from "../lib/db/client";

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const name = process.env.SUPER_ADMIN_NAME;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !name || !password) throw new Error("SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME et SUPER_ADMIN_PASSWORD sont requis.");
  const result = await initializeSuperAdmin({ email, name, password });
  console.info(result.created ? "Premier SUPER_ADMIN créé avec succès." : "Le SUPER_ADMIN existe déjà; aucune modification effectuée.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Initialisation SUPER_ADMIN impossible."); process.exitCode = 1; }).finally(() => db.$disconnect());

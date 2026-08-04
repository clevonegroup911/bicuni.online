import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminIndex() {
  await requireAdmin();
  redirect("/admin/dashboard");
}

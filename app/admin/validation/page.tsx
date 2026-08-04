import { redirect } from "next/navigation";import{requirePermission}from"@/lib/auth/guards";
export default async function ValidationPage(){await requirePermission("admin:documents:review");redirect("/admin/documents")}

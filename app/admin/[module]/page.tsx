import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/guards";
const labels={subscriptions:"Abonnements",payments:"Paiements",analytics:"Analytique",notifications:"Notifications",backups:"Sauvegardes",monitoring:"Monitoring",settings:"Paramètres"}as const;
export default async function PreparedAdminModule({params}:{params:Promise<{module:string}>}){const user=await requireAdmin();const moduleName=(await params).module;if(!(moduleName in labels))notFound();const label=labels[moduleName as keyof typeof labels];return <AdminShell user={user}><div className="admin-page"><header className="admin-title"><span className="eyebrow">Back Office BICUNI</span><h1>{label}</h1></header><section className="glass card admin-preparation"><h2>Module en préparation</h2><p>Cette route est protégée côté serveur. Elle sera activée lorsque ses opérations métier seront disponibles.</p></section></div></AdminShell>}

import { Activity, BarChart3, Bell, Building2, CreditCard, DatabaseBackup, FileCheck2, FileText, Fingerprint, LayoutDashboard, MonitorCog, Settings, ShieldCheck, Users, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { LogoutButton } from "@/components/auth/logout-button";
import { Logo } from "@/components/logo";

const navigation = [
  ["Tableau de bord", "/admin/dashboard", LayoutDashboard], ["Utilisateurs", "/admin/users", Users], ["Institutions", "/admin/institutions", Building2],
  ["Documents", "/admin/documents", FileText], ["Identifiants PID", "/admin/pids", Fingerprint], ["Validation", "/admin/validation", FileCheck2], ["Abonnements", "/admin/subscriptions", CreditCard],
  ["Paiements", "/admin/payments", WalletCards], ["Analytique", "/admin/analytics", BarChart3], ["Notifications", "/admin/notifications", Bell],
  ["Journaux d’audit", "/admin/audit", Activity], ["Sauvegardes", "/admin/backups", DatabaseBackup], ["Monitoring", "/admin/monitoring", MonitorCog],
  ["Paramètres", "/admin/settings", Settings],
] as const;

export function AdminShell({ user, children }: { user: { name: string | null; email: string; role: Role }; children: ReactNode }) {
  const initials = (user.name ?? user.email).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <main className="admin-workspace">
      <aside className="admin-navigation">
        <Logo />
        <div className="admin-brand"><ShieldCheck size={16} /><span>Back Office sécurisé</span></div>
        <nav aria-label="Navigation administrative">
          {navigation.map(([label, href, Icon]) => (
            <Link href={href} key={href}><Icon size={17} /><span>{label}</span></Link>
          ))}
        </nav>
      </aside>
      <section className="admin-content">
        <header className="admin-header">
          <div>
            <span className="eyebrow">Centre de contrôle</span>
            <strong>BICUNI Administration</strong>
          </div>
          <div className="admin-identity">
            <span className="admin-avatar">{initials}</span>
            <span><strong>{user.name ?? "Administrateur"}</strong><small>{user.role}</small></span>
            <LogoutButton />
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}

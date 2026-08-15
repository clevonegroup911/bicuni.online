"use client";

import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FileText,
  Fingerprint,
  LayoutDashboard,
  MonitorCog,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { can, type Permission } from "@/lib/auth/rbac";

const navigation: { label: string; href: string; icon: typeof LayoutDashboard; permission?: Permission }[] = [
  { label: "Tableau de bord", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Utilisateurs", href: "/admin/users", icon: Users, permission: "admin:users:read" },
  { label: "Institutions", href: "/admin/institutions", icon: Building2, permission: "admin:institutions:read" },
  { label: "Documents", href: "/admin/documents", icon: FileText, permission: "admin:documents:review" },
  { label: "Révisions", href: "/admin/validation", icon: FileCheck2, permission: "admin:documents:review" },
  { label: "PID BICUNI", href: "/admin/pids", icon: Fingerprint, permission: "admin:pids:read" },
  { label: "Abonnements", href: "/admin/subscriptions", icon: CreditCard, permission: "admin:audit:read" },
  { label: "Transactions", href: "/admin/payments", icon: WalletCards, permission: "admin:audit:read" },
  { label: "Analytique", href: "/admin/analytics", icon: BarChart3, permission: "admin:audit:read" },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
  { label: "Journaux d’audit", href: "/admin/audit", icon: Activity, permission: "admin:audit:read" },
  { label: "Sauvegardes", href: "/admin/backups", icon: DatabaseBackup },
  { label: "Monitoring", href: "/admin/monitoring", icon: MonitorCog },
  { label: "Paramètres", href: "/admin/settings", icon: Settings },
];

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navigation.filter((item) => !item.permission || can(role, item.permission));
  return (
    <nav aria-label="Navigation administrative">
      {items.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link href={item.href} key={item.href} aria-current={current ? "page" : undefined}>
            <Icon size={17} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

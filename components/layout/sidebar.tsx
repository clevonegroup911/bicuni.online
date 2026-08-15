"use client";

import {
  BookOpen,
  Clock3,
  CreditCard,
  FileCheck2,
  Heart,
  LayoutDashboard,
  Settings,
  UploadCloud,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const variants = {
  student: [
    ["Vue d’ensemble", "/dashboard", LayoutDashboard],
    ["Mes documents", "/dashboard/documents", BookOpen],
    ["Téléverser", "/documents/upload", UploadCloud],
    ["Favoris", "/dashboard/favorites", Heart],
    ["Historique", "/dashboard/history", Clock3],
    ["Abonnement", "/dashboard/subscription", CreditCard],
    ["Profil", "/dashboard/profile", UserRound],
    ["Paramètres", "/dashboard/settings", Settings],
  ],
  university: [
    ["Vue d’ensemble", "/university", LayoutDashboard],
    ["Validations", "/admin/documents", FileCheck2],
    ["Documents", "/dashboard/documents", BookOpen],
    ["Bibliothèque", "/library", BookOpen],
    ["Abonnement", "/dashboard/subscription", CreditCard],
    ["Profil", "/dashboard/profile", UserRound],
  ],
  admin: [
    ["Tableau de bord", "/admin/dashboard", LayoutDashboard],
    ["Documents", "/admin/documents", FileCheck2],
    ["Bibliothèque", "/library", BookOpen],
  ],
} as const;

export function AppSidebar({ variant = "student" }: { variant?: keyof typeof variants }) {
  const pathname = usePathname();
  return (
    <aside className="app-sidebar glass">
      <p className="eyebrow">Espace de travail</p>
      <nav aria-label="Navigation de l’espace">
        {variants[variant].map(([label, href, Icon]) => {
          const current = pathname === href || (href !== "/dashboard" && href !== "/university" && pathname.startsWith(`${href}/`));
          return (
            <Link href={href} key={`${href}-${label}`} aria-current={current ? "page" : undefined}>
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-support">
        <strong>Besoin d’aide ?</strong>
        <p>Le centre d’assistance accompagne vos dépôts académiques.</p>
        <a href="mailto:support@bicuni.online">Contacter le support</a>
      </div>
    </aside>
  );
}

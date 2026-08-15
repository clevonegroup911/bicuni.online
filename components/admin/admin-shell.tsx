import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import type { Role } from "@prisma/client";
import { LogoutButton } from "@/components/auth/logout-button";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/logo";

export function AdminShell({ user, children }: { user: { name: string | null; email: string; role: Role }; children: ReactNode }) {
  const initials = (user.name ?? user.email).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <main className="admin-workspace">
      <aside className="admin-navigation">
        <Logo />
        <div className="admin-brand"><ShieldCheck size={16} /><span>Back Office sécurisé</span></div>
        <AdminNav role={user.role} />
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

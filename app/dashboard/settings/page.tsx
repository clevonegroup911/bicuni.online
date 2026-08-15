import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { LogoutButton } from "@/components/auth/logout-button";
import { requireActiveSubscriber } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const user = await requireActiveSubscriber();
  return (
    <div>
      <DashboardHeader
        eyebrow="Compte"
        title="Paramètres."
        description="Sécurité du compte et préférences visibles. Les secrets ne sont jamais affichés."
      />
      <section className="glass card admin-panel">
        <h2>Sécurité</h2>
        <dl className="profile-dl">
          <dt>E-mail</dt>
          <dd>{user.email}</dd>
          <dt>Rôle applicatif</dt>
          <dd>{user.role}</dd>
          <dt>Mot de passe</dt>
          <dd>
            <Link className="auth-link" href="/forgot-password">Demander une réinitialisation</Link>
          </dd>
        </dl>
        <div className="admin-form-actions stack-top">
          <LogoutButton />
          <span className="muted">Déconnexion de cette session.</span>
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActiveSubscriber } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireActiveSubscriber();
  const record = await db.user.findUnique({
    where: { id: user.id },
    include: { profile: { include: { university: true, department: true } } },
  });
  if (!record) {
    return <EmptyState icon={UserRound} title="Profil indisponible" description="Votre session n’a pas pu charger le profil." />;
  }
  const profile = record.profile;
  return (
    <div>
      <DashboardHeader
        eyebrow="Identité académique"
        title="Profil."
        description="Informations associées à votre compte. La modification n’est pas encore exposée par une API."
        actions={<Link className="button secondary" href="/dashboard/settings">Paramètres</Link>}
      />
      <section className="glass card admin-panel">
        <h2>Compte</h2>
        <dl className="profile-dl">
          <dt>Nom</dt>
          <dd>{record.name ?? "Non renseigné"}</dd>
          <dt>E-mail</dt>
          <dd>{record.email}</dd>
          <dt>Rôle</dt>
          <dd>{record.role}</dd>
          <dt>Statut</dt>
          <dd>{record.status}</dd>
          <dt>Titre</dt>
          <dd>{profile?.title ?? "Non renseigné"}</dd>
          <dt>Biographie</dt>
          <dd>{profile?.bio ?? "Non renseignée"}</dd>
          <dt>Université</dt>
          <dd>{profile?.university?.name ?? "Non affilié"}</dd>
          <dt>Département</dt>
          <dd>{profile?.department?.name ?? "—"}</dd>
          <dt>Pays</dt>
          <dd>{profile?.country ?? "—"}</dd>
          <dt>ORCID</dt>
          <dd>{profile?.orcid ?? "—"}</dd>
          <dt>Site</dt>
          <dd>{profile?.website ?? "—"}</dd>
        </dl>
      </section>
    </div>
  );
}

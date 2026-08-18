import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireActiveSubscriber } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { facultyIdForDepartment } from "@/lib/profile/affiliation";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireActiveSubscriber();
  const [record, universities] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      include: { profile: { include: { university: true, department: { include: { faculty: true } } } } },
    }),
    db.university.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        faculties: { select: { id: true, name: true, departments: { select: { id: true, name: true } } } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);

  if (!record) {
    return <EmptyState icon={UserRound} title="Profil indisponible" description="Votre session n’a pas pu charger le profil." />;
  }

  const profile = record.profile;
  const taxonomy = { universities };
  const universityId = profile?.universityId ?? "";
  const departmentId = profile?.departmentId ?? "";
  const facultyId = profile?.department?.facultyId
    ?? facultyIdForDepartment(taxonomy, universityId, departmentId);

  return (
    <div>
      <DashboardHeader
        eyebrow="Identité académique"
        title="Profil."
        description="Modifiez les informations prévues par votre compte. L’e-mail et le rôle restent gérés par l’authentification."
        actions={<Link className="button secondary" href="/dashboard/settings">Paramètres</Link>}
      />
      <ProfileForm
        email={record.email}
        role={record.role}
        status={record.status}
        taxonomy={taxonomy}
        initial={{
          name: record.name ?? "",
          title: profile?.title ?? "",
          bio: profile?.bio ?? "",
          country: profile?.country ?? "",
          orcid: profile?.orcid ?? "",
          website: profile?.website ?? "",
          image: record.image ?? "",
          researchFields: profile?.researchFields.join(", ") ?? "",
          universityId,
          facultyId,
          departmentId,
        }}
      />
    </div>
  );
}

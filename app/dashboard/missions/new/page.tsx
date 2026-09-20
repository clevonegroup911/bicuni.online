import { Suspense } from "react";
import { requireUser } from "@/lib/auth/guards";
import { MissionWizard } from "@/components/outcomes/mission-wizard";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default async function NewMissionPage() {
  await requireUser();
  return (
    <main className="shell" style={{ paddingBlock: "2rem" }}>
      <Breadcrumb
        items={[
          { label: "Espace", href: "/dashboard" },
          { label: "Missions", href: "/dashboard/missions" },
          { label: "Nouvelle" },
        ]}
      />
      <Suspense fallback={<p>Chargement de l’assistant…</p>}>
        <MissionWizard />
      </Suspense>
    </main>
  );
}

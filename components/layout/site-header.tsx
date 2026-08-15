import { auth } from "@/auth";
import { isAdministrativeRole } from "@/lib/auth/rbac";
import { Header } from "@/components/layout/header";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user?.id
    ? {
        name: session.user.name ?? null,
        isAdmin: isAdministrativeRole(session.user.role),
      }
    : null;
  return <Header user={user} />;
}

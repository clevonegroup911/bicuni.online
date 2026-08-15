import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/sidebar";
import { SiteHeader } from "@/components/layout/site-header";

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <SiteHeader />
      <div id="page-content" className="shell dashboard-layout">
        <AppSidebar variant="student" />
        <div className="dashboard-content">{children}</div>
      </div>
    </>
  );
}

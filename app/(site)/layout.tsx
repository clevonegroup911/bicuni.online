import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function SiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <SiteHeader />
      <div id="page-content">{children}</div>
      <Footer />
    </>
  );
}

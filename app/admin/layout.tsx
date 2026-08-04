import type { ReactNode } from "react";

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div id="page-content" className="admin-root">{children}</div>;
}

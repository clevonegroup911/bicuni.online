import type { ReactNode } from "react";

export default function UniversityLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div id="page-content">{children}</div>;
}

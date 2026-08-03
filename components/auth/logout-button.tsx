"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  return <button className="icon-button" onClick={() => signOut({ redirectTo: "/" })} aria-label="Se déconnecter" title="Se déconnecter">
    <LogOut size={18}/>
  </button>;
}

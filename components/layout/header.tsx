"use client";

import Link from "next/link";
import { Crown, LayoutDashboard, Menu, ShieldCheck, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { CommandPalette } from "@/components/ui/command-palette";

const publicLinks = [
  ["Bibliothèque", "/library"],
  ["Recherche", "/search"],
  ["Documents", "/documents"],
  ["Universités", "/universities"],
  ["Plans", "/pricing"],
] as const;

export function Header({ user }: { user?: { name: string | null; isAdmin: boolean } | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function navCurrent(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined;
  }

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Logo />
        <nav className="desktop-nav" aria-label="Navigation principale">
          {publicLinks.map(([label, href]) => (
            <Link key={href} href={href} className="nav-link" aria-current={navCurrent(href)}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <CommandPalette />
          {user ? (
            <>
              <Link href="/dashboard" className="icon-button desktop-action" aria-label="Espace personnel">
                <LayoutDashboard size={18} />
              </Link>
              {user.isAdmin ? (
                <Link href="/admin/dashboard" className="icon-button desktop-action" aria-label="Back Office">
                  <ShieldCheck size={18} />
                </Link>
              ) : null}
              <Link href="/dashboard/profile" className="button secondary header-cta desktop-action">
                <UserRound size={16} />
                {user.name ?? "Mon espace"}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="button ghost desktop-action">Connexion</Link>
              <Link href="/signup" className="button secondary desktop-action">Inscription</Link>
              <Link href="/pricing" className="button header-cta desktop-action">
                <Crown size={16} />
                S’abonner
              </Link>
            </>
          )}
          <button
            className="mobile-toggle icon-button"
            onClick={() => setOpen(!open)}
            aria-expanded={open ? "true" : "false"}
            aria-controls="mobile-navigation"
            aria-label={open ? "Fermer le menu principal" : "Ouvrir le menu principal"}
            type="button"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-navigation" className="mobile-nav shell" aria-label="Navigation mobile" onClick={() => setOpen(false)}>
          {publicLinks.map(([label, href]) => (
            <Link key={href} href={href} aria-current={navCurrent(href)}>{label}</Link>
          ))}
          {user ? (
            <>
              <Link href="/dashboard" aria-current={navCurrent("/dashboard")}>Espace personnel</Link>
              {user.isAdmin ? <Link href="/admin/dashboard">Administration</Link> : null}
              <Link href="/dashboard/profile" aria-current={navCurrent("/dashboard/profile")}>Profil</Link>
            </>
          ) : (
            <>
              <Link href="/login">Connexion</Link>
              <Link href="/signup">Inscription</Link>
              <Link href="/pricing">Abonnements</Link>
            </>
          )}
        </nav>
      ) : null}
    </header>
  );
}

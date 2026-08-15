"use client";

import { Command, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";

const actions = [
  { label: "Rechercher dans le catalogue", href: "/search" },
  { label: "Ouvrir la bibliothèque", href: "/library" },
  { label: "Publications validées", href: "/documents" },
  { label: "Universités", href: "/universities" },
  { label: "Déposer un document", href: "/documents/upload" },
  { label: "Mon espace", href: "/dashboard" },
  { label: "Mes documents", href: "/dashboard/documents" },
  { label: "Plans et abonnements", href: "/pricing" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const filtered = actions.filter((action) => action.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <button className="command-trigger" onClick={() => setOpen(true)} aria-label="Ouvrir la palette de commandes" type="button">
        <Search size={16} />
        <span>Rechercher</span>
        <kbd><Command size={11} /> K</kbd>
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
        title="Accès rapide"
      >
        <div className="field-with-icon">
          <Search size={18} />
          <input id="command-query" className="input" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Page ou action…" aria-label="Filtrer les actions" />
        </div>
        <div className="command-list">
          {filtered.length ? filtered.map((action) => (
            <Link href={action.href} key={action.href} onClick={() => { setOpen(false); setQuery(""); }}>
              <span>{action.label}</span>
            </Link>
          )) : <p className="muted">Aucune action correspondante.</p>}
        </div>
      </Modal>
    </>
  );
}

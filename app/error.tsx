"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="page-content" className="shell page-state">
      <span className="eyebrow"><TriangleAlert size={14} />Incident temporaire</span>
      <h1>Une erreur est survenue.</h1>
      <p>Le service n’a pas pu afficher cette page. Réessayez, ou revenez à l’accueil si le problème persiste.</p>
      <div className="hero-actions">
        <button type="button" className="button" onClick={reset}>Réessayer</button>
        <Link className="button secondary" href="/">Accueil</Link>
      </div>
    </main>
  );
}

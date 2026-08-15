import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main id="page-content" className="shell page-state">
      <span className="eyebrow"><Compass size={14} />Page introuvable</span>
      <h1>Cette ressource n’existe pas.</h1>
      <p>L’adresse a pu changer, ou le contenu n’est plus disponible. Revenez à l’accueil ou poursuivez dans la bibliothèque.</p>
      <div className="hero-actions">
        <Link className="button" href="/">Accueil</Link>
        <Link className="button secondary" href="/library">Bibliothèque</Link>
        <Link className="button secondary" href="/search">Recherche</Link>
      </div>
    </main>
  );
}

import Link from "next/link";
import { ShieldOff } from "lucide-react";

export default function AdminDeniedPage() {
  return (
    <main className="shell page-state">
      <span className="eyebrow"><ShieldOff size={14} />Accès interdit</span>
      <h1>Autorisation insuffisante.</h1>
      <p>Votre compte ne dispose pas des permissions nécessaires pour accéder au Back Office. L’autorité finale reste le serveur.</p>
      <div className="hero-actions">
        <Link className="button" href="/dashboard">Retour à votre espace</Link>
        <Link className="button secondary" href="/">Accueil</Link>
      </div>
    </main>
  );
}

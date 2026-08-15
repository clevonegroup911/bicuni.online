import type { Metadata } from "next";
import { BellRing, CalendarDays, FlaskConical, GraduationCap, Rss } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Actualité" };
const categories = [[FlaskConical, "Recherche"], [GraduationCap, "Bourses"], [CalendarDays, "Événements"]] as const;

export default function News() {
  return (
    <main className="shell">
      <header className="page-hero">
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Actualité" }]} />
        <span className="eyebrow eyebrow-spaced"><Rss size={14} />Actualité & veille scientifique</span>
        <h1>Les idées qui avancent.</h1>
        <p>Les annonces institutionnelles, appels à projets et événements seront publiés ici après vérification éditoriale.</p>
      </header>
      <section className="news-layout">
        <aside className="glass card news-sidebar">
          <strong>Thématiques</strong>
          {categories.map(([Icon, label]) => <span key={label}><Icon size={17} />{label}</span>)}
        </aside>
        <EmptyState
          icon={BellRing}
          title="Aucune actualité publiée"
          description="BICUNI n’affiche aucune information non vérifiée. Les premières actualités apparaîtront après validation éditoriale."
        />
      </section>
    </main>
  );
}

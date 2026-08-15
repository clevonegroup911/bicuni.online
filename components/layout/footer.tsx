import Link from "next/link";
import { ArrowUpRight, Globe2, Mail } from "lucide-react";
import { Logo } from "@/components/logo";

const columns = [
  { title: "Explorer", links: [["Bibliothèque", "/library"], ["Recherche", "/search"], ["Documents", "/documents"], ["Universités", "/universities"]] },
  { title: "Publier", links: [["Déposer un document", "/documents/upload"], ["Espace académique", "/dashboard"], ["Actualité", "/news"]] },
  { title: "BICUNI", links: [["Plans", "/pricing"], ["Connexion", "/login"], ["Inscription", "/signup"]] },
] as const;

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-main">
        <div className="footer-brand">
          <Logo />
          <p>La mémoire scientifique africaine, préservée et rendue accessible dans une infrastructure académique souveraine.</p>
          <a href="mailto:contact@bicuni.online"><Mail size={15} />contact@bicuni.online</a>
        </div>
        {columns.map((column) => (
          <div className="footer-column" key={column.title}>
            <strong>{column.title}</strong>
            {column.links.map(([label, href]) => (
              <Link href={href} key={href}>{label}<ArrowUpRight size={13} /></Link>
            ))}
          </div>
        ))}
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} BICUNI.ONLINE</span>
        <span><Globe2 size={14} />Bibliothèque Centrale Universelle · Afrique</span>
      </div>
    </footer>
  );
}

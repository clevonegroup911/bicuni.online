import Link from "next/link";
export default function AdminDeniedPage(){return <main className="shell"><section className="page-hero"><span className="eyebrow">Accès refusé</span><h1>Autorisation insuffisante.</h1><p>Votre compte ne dispose pas des permissions nécessaires pour accéder au Back Office.</p><Link className="button" href="/dashboard">Retour à votre espace</Link></section></main>}

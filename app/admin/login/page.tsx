import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Connexion administrateur" };
export default function AdminLoginPage() { return <main className="admin-login"><section className="glass card"><Logo/><span className="eyebrow"><ShieldCheck size={15}/>Accès restreint</span><h1>Administration BICUNI.</h1><p>Cette zone est exclusivement réservée aux comptes administratifs actifs.</p><AdminLoginForm/></section></main>; }

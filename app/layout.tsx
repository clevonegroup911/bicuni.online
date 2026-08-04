import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./layout.css";
import "./landing.css";
import "./ui.css";
import "./dashboard.css";
import "./auth.css";
import "./public.css";
import "./accessibility.css";
import "./search.css";
import "./admin.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "BICUNI — Bibliothèque Centrale Universelle", template: "%s | BICUNI" },
  description: "L’infrastructure académique numérique panafricaine pour rechercher, publier et valoriser le savoir.",
  metadataBase: new URL("https://bicuni.online")
};
export const viewport: Viewport = { themeColor: "#020617", colorScheme: "dark", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <ToastProvider>
          <a className="skip-link" href="#page-content">Aller au contenu</a>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}

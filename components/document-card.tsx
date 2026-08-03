"use client";

import { Bookmark, Download, Eye, FileText } from "lucide-react";
import { useState } from "react";

export function DocumentCard({ document }: { document: { type: string; title: string; author: string; university: string; year: string; category: string } }) {
  const [saved, setSaved] = useState(false);
  return <article className="glass card" style={{ padding: 20, display: "flex", flexDirection: "column", minHeight: 300 }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ display: "inline-flex", gap: 7, alignItems: "center", color: "#8fa2ff", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".1em" }}><FileText size={15}/>{document.type}</span>
      <button onClick={() => setSaved(!saved)} className="icon-button" aria-label="Ajouter aux favoris" style={{ color: saved ? "#e60012" : undefined }}><Bookmark size={17} fill={saved ? "currentColor" : "none"}/></button>
    </div>
    <h3 style={{ fontSize: 20, lineHeight: 1.25, margin: "24px 0 10px" }}>{document.title}</h3>
    <p style={{ color: "var(--muted)", margin: 0 }}>{document.author}</p>
    <p style={{ color: "#737d94", fontSize: 13 }}>{document.university} · {document.year}</p>
    <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ padding: "6px 9px", borderRadius: 8, background: "rgba(11,46,255,.12)", color: "#91a2ff", fontSize: 12 }}>{document.category}</span>
      <div style={{ display: "flex", gap: 7 }}><button className="icon-button" aria-label="Aperçu"><Eye size={17}/></button><button className="icon-button" aria-label="Télécharger"><Download size={17}/></button></div>
    </div>
  </article>;
}

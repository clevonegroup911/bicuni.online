import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" aria-label="BICUNI — Accueil" style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 23 }}>
    <svg width="43" height="43" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="none" stroke="#E60012" strokeWidth="5"/>
      <circle cx="32" cy="32" r="21" fill="none" stroke="#0B2EFF" strokeWidth="5"/>
      <circle cx="32" cy="32" r="13" fill="none" stroke="#050505" strokeWidth="5"/>
      <circle cx="32" cy="32" r="5" fill="#fff" style={{ filter: "drop-shadow(0 0 7px white)" }}/>
    </svg>
    {!compact && <span><i style={{ color: "#0B2EFF", fontStyle: "normal" }}>Bi</i><i style={{ color: "#E60012", fontStyle: "normal" }}>cuni</i></span>}
  </Link>;
}

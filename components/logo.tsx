import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand-logo" aria-label="BICUNI — Accueil">
      <svg width="43" height="43" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="29" fill="none" stroke="#E60012" strokeWidth="5" />
        <circle cx="32" cy="32" r="21" fill="none" stroke="#0B2EFF" strokeWidth="5" />
        <circle cx="32" cy="32" r="13" fill="none" stroke="#050505" strokeWidth="5" />
        <circle className="brand-logo-core" cx="32" cy="32" r="5" fill="#fff" />
      </svg>
      {!compact && (
        <span className="logo-wordmark">
          <span className="logo-bi">Bi</span>
          <span className="logo-cuni">cuni</span>
        </span>
      )}
    </Link>
  );
}

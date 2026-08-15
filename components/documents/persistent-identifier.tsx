import { CopyButton } from "@/components/ui/copy-button";

export function PersistentIdentifierBlock({
  identifier,
  href,
}: {
  identifier: string;
  href: string;
}) {
  return (
    <div className="pid-block">
      <span className="eyebrow">Identifiant pérenne BICUNI</span>
      <code>{identifier}</code>
      <div className="pid-actions">
        <CopyButton value={identifier} label="Copier le PID BICUNI" />
        <a className="button secondary" href={href}>Lien canonique</a>
      </div>
      <p>Le PID BICUNI est un identifiant interne pérenne. Ce n’est pas un DOI officiel enregistré auprès d’un registrar.</p>
    </div>
  );
}

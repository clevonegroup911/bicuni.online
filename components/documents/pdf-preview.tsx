import Link from "next/link";

export function PDFPreview({
  url,
  title,
  hasFile = false,
  loginHref,
}: {
  url?: string;
  title: string;
  hasFile?: boolean;
  loginHref?: string;
}) {
  if (url) {
    return <iframe className="pdf-preview glass" src={url} title={`Prévisualisation de ${title}`} />;
  }
  return (
    <div className="pdf-preview glass empty-state">
      <p>
        {hasFile
          ? "La prévisualisation en ligne est réservée aux comptes connectés. Le fichier reste servi depuis un stockage privé."
          : "Aucun fichier n’est encore associé à ce document."}
      </p>
      {hasFile && loginHref ? (
        <Link className="button secondary" href={loginHref}>Se connecter pour prévisualiser</Link>
      ) : null}
    </div>
  );
}

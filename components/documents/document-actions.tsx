"use client";

import { Bookmark, Download, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DownloadButton({ fileId }: { fileId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="action-cluster">
      <button
        className="button"
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const response = await fetch(`/api/documents/files/${fileId}?action=download`);
            const result = await response.json() as { url?: string; error?: string };
            if (result.url) window.location.assign(result.url);
            else setError(result.error ?? "Téléchargement indisponible.");
          } catch {
            setError("Téléchargement indisponible.");
          }
          setBusy(false);
        }}
      >
        <Download size={17} />{busy ? "Préparation…" : "Télécharger"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function FavoriteButton({
  documentId,
  initialFavorited = false,
}: {
  documentId: string;
  initialFavorited?: boolean;
}) {
  const [active, setActive] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="action-cluster">
      <button
        className="button secondary"
        type="button"
        aria-pressed={active}
        aria-busy={busy}
        disabled={busy}
        onClick={async () => {
          setError("");
          setBusy(true);
          try {
            const response = await fetch(`/api/documents/${documentId}/favorite`, { method: "PATCH" });
            if (response.status === 401) {
              window.location.assign(`/login?next=${encodeURIComponent(`/documents/${documentId}`)}`);
              return;
            }
            if (!response.ok) {
              setError("Impossible de mettre à jour le favori.");
              return;
            }
            setActive((await response.json() as { favorite: boolean }).favorite);
          } catch {
            setError("Favori momentanément indisponible.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Bookmark size={17} fill={active ? "currentColor" : "none"} />
        {active ? "Enregistré" : "Favori"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="action-cluster">
      <button
        className="button secondary"
        type="button"
        onClick={async () => {
          const url = window.location.href;
          try {
            if (navigator.share) await navigator.share({ title, url });
            else {
              await navigator.clipboard.writeText(url);
              setMessage("Lien copié.");
              window.setTimeout(() => setMessage(""), 1800);
            }
          } catch (cause) {
            if (cause instanceof DOMException && cause.name === "AbortError") return;
            setMessage("Le partage n’a pas pu aboutir.");
          }
        }}
      >
        <Share2 size={17} />Partager
      </button>
      {message ? <p className="form-success" role="status">{message}</p> : null}
    </div>
  );
}

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="action-cluster">
      <button
        className="button red"
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          if (!window.confirm("Supprimer ce brouillon ?")) return;
          setBusy(true);
          setError("");
          try {
            const response = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
            if (response.ok) {
              router.push("/dashboard/documents");
              router.refresh();
              return;
            }
            setError("Suppression refusée.");
          } catch {
            setError("Suppression momentanément indisponible.");
          }
          setBusy(false);
        }}
      >
        <Trash2 size={17} />Supprimer
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}

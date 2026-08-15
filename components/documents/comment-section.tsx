"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CommentCard } from "@/components/documents/comment-card";

type Comment = { id: string; body: string; createdAt: string; author: { name: string | null } };

export function CommentSection({
  documentId,
  initialComments,
  signedIn = false,
}: {
  documentId: string;
  initialComments: Comment[];
  signedIn?: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form).get("body");
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${documentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const result = await response.json() as Comment & { error?: string };
      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(`/documents/${documentId}`)}`);
        return;
      }
      if (!response.ok) {
        setPending(false);
        return setError(result.error ?? "Commentaire refusé.");
      }
      setComments((current) => [...current, result]);
      form.reset();
    } catch {
      setError("Commentaire momentanément indisponible.");
    }
    setPending(false);
  }

  return (
    <section>
      <h2>Commentaires ({comments.length})</h2>
      <div className="comments">
        {comments.length ? comments.map((comment) => (
          <CommentCard key={comment.id} name={comment.author.name ?? "Membre BICUNI"} body={comment.body} date={new Date(comment.createdAt)} />
        )) : <p className="muted">Aucun commentaire pour le moment.</p>}
      </div>
      {signedIn ? (
        <form onSubmit={submit} className="auth-form comment-form">
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <label htmlFor="comment-body">Votre commentaire
            <textarea id="comment-body" className="input textarea" name="body" required minLength={2} maxLength={3000} />
          </label>
          <button className="button" disabled={pending} aria-busy={pending}>{pending ? "Publication…" : "Commenter"}</button>
        </form>
      ) : (
        <p className="muted">
          <Link className="auth-link" href={`/login?next=${encodeURIComponent(`/documents/${documentId}`)}`}>Connectez-vous</Link>
          {" "}pour commenter cette publication.
        </p>
      )}
    </section>
  );
}

"use client";

import type { InstitutionStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function InstitutionActions({
  id,
  status,
  canChangeStatus,
}: {
  id: string;
  status: InstitutionStatus;
  canChangeStatus: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  if (!canChangeStatus) return <small>Consultation / édition limitée</small>;

  async function patch(next: InstitutionStatus, confirmation: string) {
    if (!window.confirm(confirmation)) return;
    setMessage("Mise à jour…");
    const response = await fetch(`/api/admin/institutions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", status: next }),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Statut mis à jour." : result.error ?? "Action refusée.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="admin-institution-actions">
      {status !== "ACTIVE" ? (
        <button className="button" type="button" onClick={() => patch("ACTIVE", "Activer cette institution ?")}>
          Activer
        </button>
      ) : null}
      {status === "ACTIVE" ? (
        <button
          className="button secondary"
          type="button"
          onClick={() => patch("SUSPENDED", "Suspendre cette institution ?")}
        >
          Suspendre
        </button>
      ) : null}
      {status !== "ARCHIVED" ? (
        <button
          className="button secondary"
          type="button"
          onClick={() => patch("ARCHIVED", "Archiver cette institution ? Aucune suppression physique ne sera effectuée.")}
        >
          Archiver
        </button>
      ) : null}
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}

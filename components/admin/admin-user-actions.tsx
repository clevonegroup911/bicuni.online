"use client";

import type { Role, UserStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const roles: Role[] = [
  "USER",
  "STUDENT",
  "RESEARCHER",
  "MODERATOR",
  "INSTITUTION_ADMIN",
  "UNIVERSITY_ADMIN",
  "ADMIN",
  "GOVERNMENT",
  "SUPER_ADMIN",
];

type SecurityEvent = {
  id: string;
  action: string;
  createdAt: string;
  entityType: string;
  entityId: string | null;
};

export function AdminUserActions({
  id,
  role,
  status,
  disabled,
}: {
  id: string;
  role: Role;
  status: UserStatus;
  disabled: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);

  async function patch(body: unknown, confirmation: string) {
    if (!window.confirm(confirmation)) return;
    setMessage("Mise à jour…");
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { error?: string; resent?: boolean };
    setMessage(response.ok ? (result.resent ? "Lien renvoyé" : "Enregistré") : result.error ?? "Action refusée");
    if (response.ok) router.refresh();
  }

  async function loadSecurityEvents() {
    setEventsOpen(true);
    setMessage("Chargement des événements…");
    const response = await fetch(`/api/admin/users/${id}?events=1`);
    const result = await response.json() as { events?: SecurityEvent[]; error?: string };
    if (!response.ok) {
      setMessage(result.error ?? "Impossible de charger les événements");
      return;
    }
    setEvents(result.events ?? []);
    setMessage("");
  }

  if (disabled) {
    return (
      <div className="admin-user-actions">
        <small>Compte courant</small>
      </div>
    );
  }

  return (
    <div className="admin-user-actions">
      <select
        className="input"
        value={role}
        aria-label="Rôle"
        onChange={(event) =>
          patch({ action: "role", role: event.target.value }, "Confirmer ce changement de rôle ?")
        }
      >
        {roles.map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>

      {status === "PENDING" && (
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            patch(
              { action: "resend_verification" },
              "Renvoyer le lien de vérification à cet utilisateur ?",
            )
          }
        >
          Renvoyer le lien de vérification
        </button>
      )}

      {status === "ACTIVE" && (
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            patch(
              { action: "status", status: "SUSPENDED" },
              "Suspendre immédiatement ce compte ?",
            )
          }
        >
          Suspendre
        </button>
      )}

      {(status === "SUSPENDED" || status === "DELETED") && (
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            patch(
              { action: "status", status: "ACTIVE" },
              "Réactiver ce compte ? L’adresse email doit déjà être vérifiée.",
            )
          }
        >
          Réactiver
        </button>
      )}

      {status === "PENDING" && (
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            patch(
              { action: "status", status: "SUSPENDED" },
              "Suspendre ce compte en attente ?",
            )
          }
        >
          Suspendre
        </button>
      )}

      <button type="button" className="button secondary" onClick={loadSecurityEvents}>
        Événements de sécurité
      </button>

      {message && <small role="status">{message}</small>}

      {eventsOpen && (
        <div className="admin-user-events" role="region" aria-label="Événements de sécurité">
          {!events?.length ? (
            <small>Aucun événement récent.</small>
          ) : (
            <ul>
              {events.map((event) => (
                <li key={event.id}>
                  <code>{event.action}</code>
                  {" · "}
                  {new Date(event.createdAt).toLocaleString("fr-FR")}
                </li>
              ))}
            </ul>
          )}
          <a className="auth-link" href={`/admin/audit?entityId=${encodeURIComponent(id)}`}>
            Voir dans l’audit
          </a>
        </div>
      )}
    </div>
  );
}

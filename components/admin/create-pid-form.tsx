"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PID_SUFFIX_TYPE_CODES, PID_SUFFIX_TYPES } from "@/lib/pid/types";

export function CreatePidForm() {
  const router = useRouter();
  const [resourceType, setResourceType] = useState("document");
  const [suffixType, setSuffixType] = useState(PID_SUFFIX_TYPE_CODES.ART);
  const [resourceId, setResourceId] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const boundResourceId = resourceId.trim();
    if (!boundResourceId) {
      setMessage("La ressource est obligatoire.");
      return;
    }
    setBusy(true);
    setMessage("Création…");
    const response = await fetch("/api/admin/pids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType,
        suffixType,
        resourceId: boundResourceId,
        targetUrl: targetUrl.trim(),
      }),
    });
    const result = (await response.json()) as { error?: string; identifier?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Création refusée.");
      return;
    }
    setMessage(`Créé : ${result.identifier}`);
    setResourceId("");
    router.refresh();
  }

  return (
    <form className="create-admin glass card" onSubmit={onSubmit}>
      <strong>Créer un identifiant BICUNI PID</strong>
      <div className="admin-filters" style={{ marginTop: 16, marginBottom: 0 }}>
        <select className="input" value={resourceType} onChange={(event) => setResourceType(event.target.value)} aria-label="Type de ressource">
          <option value="document">document</option>
          <option value="publication">publication</option>
        </select>
        <select className="input" value={suffixType} onChange={(event) => setSuffixType(event.target.value)} aria-label="Type de suffixe">
          {PID_SUFFIX_TYPES.map((type) => (
            <option key={type} value={PID_SUFFIX_TYPE_CODES[type]}>{type}</option>
          ))}
        </select>
        <input
          className="input"
          value={resourceId}
          onChange={(event) => setResourceId(event.target.value)}
          placeholder="resourceId (cuid du document ou de la publication)"
          required
        />
        <input className="input" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://bicuni.online/documents/…" required />
        <button className="button" disabled={busy}>Créer</button>
      </div>
      {message ? <small role="status">{message}</small> : null}
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { UploadZone } from "@/components/documents/upload-zone";
import { Field } from "@/components/ui/field";

type Taxonomy = {
  categories: { id: string; name: string }[];
  universities: { id: string; name: string; faculties: { id: string; name: string; departments: { id: string; name: string }[] }[] }[];
};

const MAX_UPLOAD_BYTES = Number(process.env.NEXT_PUBLIC_DOCUMENT_MAX_UPLOAD_BYTES ?? 52_428_800);

export function MetadataForm({ taxonomy }: { taxonomy: Taxonomy }) {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [university, setUniversity] = useState("");
  const [faculty, setFaculty] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [pending, setPending] = useState(false);
  const faculties = taxonomy.universities.find((item) => item.id === university)?.faculties ?? [];
  const departments = faculties.find((item) => item.id === faculty)?.departments ?? [];
  const limitLabel = useMemo(() => `${Math.round(MAX_UPLOAD_BYTES / 1_048_576)} Mo`, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("Sélectionnez un fichier PDF ou DOCX.");
    if (file.size > MAX_UPLOAD_BYTES) return setError(`Le fichier dépasse la limite de ${limitLabel}.`);
    setError("");
    setPending(true);
    setProgress("Préparation sécurisée…");
    try {
      const form = new FormData(event.currentTarget);
      const checksum = await sha256(file);
      const payload = {
        ...Object.fromEntries(form),
        universityId: university || null,
        facultyId: faculty || null,
        departmentId: String(form.get("departmentId") || "") || null,
        keywords: String(form.get("keywords")).split(",").map((value) => value.trim()).filter(Boolean),
        mimeType: file.type,
        fileName: file.name,
        sizeBytes: file.size,
        checksum,
      };
      const created = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await created.json() as { error?: string; uploadUrl?: string; fileId?: string; documentId?: string };
      if (!created.ok || !result.uploadUrl || !result.fileId) {
        setPending(false);
        return setError(result.error ?? "Création impossible.");
      }
      setProgress("Transfert chiffré vers le stockage privé…");
      const uploaded = await fetch(result.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploaded.ok) {
        setPending(false);
        return setError("Le transfert du fichier a échoué.");
      }
      setProgress("Vérification du fichier…");
      const confirmed = await fetch("/api/documents/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: result.fileId }),
      });
      if (!confirmed.ok) {
        setPending(false);
        return setError("Le fichier transféré n’a pas pu être confirmé.");
      }
      router.push(`/documents/${result.documentId}`);
      router.refresh();
    } catch {
      setPending(false);
      setError("Téléversement momentanément indisponible. Réessayez.");
    }
  }

  return (
    <form className="metadata-form glass card" onSubmit={submit}>
      <UploadZone onFile={setFile} />
      {file ? <p className="muted">Fichier sélectionné : {file.name} ({Math.round(file.size / 1024)} Ko). Limite {limitLabel}.</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {progress ? <p className="form-success" role="status">{progress}</p> : null}
      <div className="form-grid">
        <Field id="title" label="Titre">
          <input id="title" className="input" name="title" required minLength={5} />
        </Field>
        <Field id="type" label="Type">
          <select id="type" className="input" name="type" required>
            {["TFC", "MEMOIRE", "THESE", "ARTICLE", "RAPPORT"].map((value) => <option key={value}>{value}</option>)}
          </select>
        </Field>
        <label className="span-2" htmlFor="abstract">Résumé
          <textarea id="abstract" className="input textarea" name="abstract" required minLength={20} />
        </label>
        <Field id="university" label="Université">
          <select id="university" className="input" value={university} onChange={(event) => { setUniversity(event.target.value); setFaculty(""); }}>
            <option value="">Indépendant</option>
            {taxonomy.universities.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field id="faculty" label="Faculté">
          <select id="faculty" className="input" value={faculty} onChange={(event) => setFaculty(event.target.value)}>
            <option value="">—</option>
            {faculties.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field id="departmentId" label="Département">
          <select id="departmentId" className="input" name="departmentId">
            <option value="">—</option>
            {departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field id="categoryId" label="Catégorie">
          <select id="categoryId" className="input" name="categoryId" required>
            <option value="">Choisir</option>
            {taxonomy.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field id="promotion" label="Promotion">
          <input id="promotion" className="input" name="promotion" />
        </Field>
        <Field id="academicYear" label="Année académique">
          <input id="academicYear" className="input" name="academicYear" placeholder="2025-2026" pattern="[0-9]{4}-[0-9]{4}" required />
        </Field>
        <Field id="year" label="Année">
          <input id="year" className="input" name="year" type="number" min="1800" max={new Date().getFullYear() + 1} required />
        </Field>
        <Field id="language" label="Langue">
          <input id="language" className="input" name="language" defaultValue="fr" required />
        </Field>
        <Field id="license" label="Licence">
          <input id="license" className="input" name="license" defaultValue="CC BY-NC 4.0" required />
        </Field>
        <label className="span-2" htmlFor="keywords">Mots-clés
          <input id="keywords" className="input" name="keywords" placeholder="éducation, intelligence artificielle" required />
        </label>
      </div>
      <p className="muted">Le document est enregistré en brouillon. Vous pourrez le soumettre à révision depuis sa fiche.</p>
      <button className="button" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? progress || "Téléversement…" : "Enregistrer le brouillon"}
      </button>
    </form>
  );
}

async function sha256(file: File) {
  const buffer = await file.arrayBuffer();
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))].map((value) => value.toString(16).padStart(2, "0")).join("");
}

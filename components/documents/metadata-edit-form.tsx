"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Field } from "@/components/ui/field";

type Initial = {
  title: string;
  abstract: string | null;
  promotion: string | null;
  academicYear: string;
  year: number | null;
  language: string;
  type: string;
  license: string;
  categoryId: string;
  tags: { name: string }[];
};

export function MetadataEditForm({
  documentId,
  initial,
  categories,
}: {
  documentId: string;
  initial: Initial;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      ...Object.fromEntries(form),
      keywords: String(form.get("keywords")).split(",").map((value) => value.trim()).filter(Boolean),
    };
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setPending(false);
        return setError(result.error ?? "Modification refusée.");
      }
      setDirty(false);
      router.push(`/documents/${documentId}`);
      router.refresh();
    } catch {
      setPending(false);
      setError("Enregistrement momentanément indisponible.");
    }
  }

  return (
    <form className="metadata-form glass card" onSubmit={submit} onChange={() => setDirty(true)}>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="form-grid">
        <label className="span-2" htmlFor="title">Titre
          <input id="title" className="input" name="title" defaultValue={initial.title} required />
        </label>
        <label className="span-2" htmlFor="abstract">Résumé
          <textarea id="abstract" className="input textarea" name="abstract" defaultValue={initial.abstract ?? ""} required />
        </label>
        <Field id="type" label="Type">
          <select id="type" className="input" name="type" defaultValue={initial.type}>
            {["TFC", "MEMOIRE", "THESE", "ARTICLE", "RAPPORT"].map((value) => <option key={value}>{value}</option>)}
          </select>
        </Field>
        <Field id="categoryId" label="Catégorie">
          <select id="categoryId" className="input" name="categoryId" defaultValue={initial.categoryId}>
            {categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field id="promotion" label="Promotion">
          <input id="promotion" className="input" name="promotion" defaultValue={initial.promotion ?? ""} />
        </Field>
        <Field id="academicYear" label="Année académique">
          <input id="academicYear" className="input" name="academicYear" defaultValue={initial.academicYear} />
        </Field>
        <Field id="year" label="Année">
          <input id="year" className="input" type="number" name="year" defaultValue={initial.year ?? ""} />
        </Field>
        <Field id="language" label="Langue">
          <input id="language" className="input" name="language" defaultValue={initial.language} />
        </Field>
        <Field id="license" label="Licence">
          <input id="license" className="input" name="license" defaultValue={initial.license} />
        </Field>
        <label className="span-2" htmlFor="keywords">Mots-clés
          <input id="keywords" className="input" name="keywords" defaultValue={initial.tags.map((tag) => tag.name).join(", ")} />
        </label>
      </div>
      <div className="admin-form-actions">
        <button className="button" disabled={pending} aria-busy={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</button>
        <Link className="button secondary" href={`/documents/${documentId}`} onClick={(event) => {
          if (dirty && !window.confirm("Des modifications non enregistrées seront perdues. Continuer ?")) event.preventDefault();
        }}>Annuler</Link>
      </div>
    </form>
  );
}

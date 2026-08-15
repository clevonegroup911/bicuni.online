"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Field } from "@/components/ui/field";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { departmentsFor, facultiesFor, facultyIdForDepartment } from "@/lib/profile/affiliation";
import {
  flattenProfileErrors,
  valuesToPayload,
  type AffiliationTaxonomy,
  type ProfileFormValues,
  PROFILE_WRITE_PATH,
} from "@/lib/profile/contract";
import { parseWriteResponse, sessionLoginHref } from "@/lib/ui/write-api";

const MISSING_API = "L’enregistrement n’a pas eu lieu : l’API PATCH /api/profile n’est pas encore disponible. Aucune donnée n’a été simulée.";

export function ProfileForm({
  initial,
  taxonomy,
  email,
  role,
  status,
}: {
  initial: ProfileFormValues;
  taxonomy: AffiliationTaxonomy;
  email: string;
  role: string;
  status: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const faculties = useMemo(() => facultiesFor(taxonomy, values.universityId), [taxonomy, values.universityId]);
  const departments = useMemo(
    () => departmentsFor(taxonomy, values.universityId, values.facultyId),
    [taxonomy, values.universityId, values.facultyId],
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function update<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setDirty(true);
    setSuccess("");
    setValues((current) => ({ ...current, [key]: value }));
  }

  function changeUniversity(universityId: string) {
    setDirty(true);
    setSuccess("");
    setValues((current) => ({ ...current, universityId, facultyId: "", departmentId: "" }));
  }

  function changeFaculty(facultyId: string) {
    setDirty(true);
    setSuccess("");
    setValues((current) => ({ ...current, facultyId, departmentId: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    setFields({});

    const parsed = valuesToPayload(values);
    if (!parsed.success) {
      setPending(false);
      setFields(flattenProfileErrors(parsed.error));
      setError("Corrigez les champs indiqués avant d’enregistrer.");
      return;
    }

    if (parsed.data.departmentId && !facultyIdForDepartment(taxonomy, parsed.data.universityId ?? "", parsed.data.departmentId)) {
      setPending(false);
      setFields({ departmentId: "Ce département n’appartient pas à l’université choisie." });
      setError("L’affiliation universitaire est incohérente.");
      return;
    }

    try {
      const response = await fetch(PROFILE_WRITE_PATH, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(parsed.data),
      });
      const result = await parseWriteResponse<{ error?: string }>(response);
      if (!result.ok) {
        if (result.kind === "session") {
          window.location.assign(sessionLoginHref("/dashboard/profile"));
          return;
        }
        setPending(false);
        setFields(result.fields ?? {});
        setError(result.kind === "missing" ? MISSING_API : result.message);
        return;
      }
      setDirty(false);
      setPending(false);
      setSuccess("Profil enregistré.");
      router.refresh();
    } catch {
      setPending(false);
      setError("Enregistrement momentanément indisponible. Réessayez.");
    }
  }

  return (
    <form className="metadata-form glass card" onSubmit={submit} noValidate>
      <div className="profile-identity">
        <ProfileAvatar name={values.name || email} image={values.image} />
        <div>
          <p className="muted">E-mail, rôle et statut ne sont pas modifiables ici.</p>
          <dl className="profile-dl compact">
            <dt>E-mail</dt>
            <dd>{email}</dd>
            <dt>Rôle</dt>
            <dd>{role}</dd>
            <dt>Statut</dt>
            <dd>{status}</dd>
          </dl>
        </div>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {success ? <p className="form-success" role="status">{success}</p> : null}
      {dirty ? <p className="muted dirty-hint" role="status">Modifications non enregistrées.</p> : null}

      <div className="form-grid">
        <Field id="name" label="Nom" error={fields.name}>
          <input
            id="name"
            className="input"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            maxLength={120}
            aria-invalid={Boolean(fields.name)}
          />
        </Field>
        <Field id="title" label="Titre académique" hint="Ex. Doctorant, Enseignant-chercheur" error={fields.title}>
          <input
            id="title"
            className="input"
            name="title"
            value={values.title}
            onChange={(event) => update("title", event.target.value)}
            maxLength={160}
            aria-invalid={Boolean(fields.title)}
          />
        </Field>
        <label className="span-2" htmlFor="bio">Biographie
          <textarea
            id="bio"
            className="input textarea"
            name="bio"
            value={values.bio}
            onChange={(event) => update("bio", event.target.value)}
            maxLength={2000}
            aria-invalid={Boolean(fields.bio)}
            aria-describedby={fields.bio ? "bio-error" : undefined}
          />
          {fields.bio ? <small id="bio-error" className="field-error" role="alert">{fields.bio}</small> : null}
        </label>
        <Field id="country" label="Pays" error={fields.country}>
          <input
            id="country"
            className="input"
            name="country"
            autoComplete="country-name"
            value={values.country}
            onChange={(event) => update("country", event.target.value)}
            maxLength={80}
            aria-invalid={Boolean(fields.country)}
          />
        </Field>
        <Field id="orcid" label="ORCID" hint="Format 0000-0002-1825-0097" error={fields.orcid}>
          <input
            id="orcid"
            className="input"
            name="orcid"
            value={values.orcid}
            onChange={(event) => update("orcid", event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={Boolean(fields.orcid)}
          />
        </Field>
        <Field id="website" label="Site" error={fields.website}>
          <input
            id="website"
            className="input"
            name="website"
            type="url"
            placeholder="https://"
            value={values.website}
            onChange={(event) => update("website", event.target.value)}
            aria-invalid={Boolean(fields.website)}
          />
        </Field>
        <Field
          id="image"
          label="Avatar (URL)"
          hint="Le stockage GCS actuel est réservé aux documents privés. Seule une URL déjà publique peut être enregistrée."
          error={fields.image}
        >
          <input
            id="image"
            className="input"
            name="image"
            type="url"
            value={values.image}
            onChange={(event) => update("image", event.target.value)}
            aria-invalid={Boolean(fields.image)}
          />
        </Field>
        <label className="span-2" htmlFor="researchFields">Domaines de recherche
          <input
            id="researchFields"
            className="input"
            name="researchFields"
            value={values.researchFields}
            onChange={(event) => update("researchFields", event.target.value)}
            placeholder="éducation, intelligence artificielle"
            aria-describedby="researchFields-hint"
          />
          <small id="researchFields-hint">Séparés par des virgules. Maximum 12.</small>
        </label>
        <Field id="universityId" label="Université" error={fields.universityId}>
          <select
            id="universityId"
            className="input"
            name="universityId"
            value={values.universityId}
            onChange={(event) => changeUniversity(event.target.value)}
            aria-invalid={Boolean(fields.universityId)}
          >
            <option value="">Non affilié</option>
            {taxonomy.universities.map((item) => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))}
          </select>
        </Field>
        <Field id="facultyId" label="Faculté" hint="Non stockée sur le profil : elle sert à choisir le département.">
          <select
            id="facultyId"
            className="input"
            name="facultyId"
            value={values.facultyId}
            onChange={(event) => changeFaculty(event.target.value)}
            disabled={!values.universityId}
          >
            <option value="">—</option>
            {faculties.map((item) => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))}
          </select>
        </Field>
        <Field id="departmentId" label="Département" error={fields.departmentId}>
          <select
            id="departmentId"
            className="input"
            name="departmentId"
            value={values.departmentId}
            onChange={(event) => update("departmentId", event.target.value)}
            disabled={!values.facultyId}
            aria-invalid={Boolean(fields.departmentId)}
          >
            <option value="">—</option>
            {departments.map((item) => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="admin-form-actions">
        <button className="button" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le profil"}
        </button>
        <Link
          className="button secondary"
          href="/dashboard"
          onClick={(event) => {
            if (dirty && !window.confirm("Des modifications non enregistrées seront perdues. Continuer ?")) {
              event.preventDefault();
            }
          }}
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}

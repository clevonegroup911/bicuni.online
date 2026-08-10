"use client";

import type { InstitutionStatus, InstitutionType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

const types: InstitutionType[] = ["UNIVERSITY", "HIGHER_INSTITUTE", "RESEARCH_CENTER", "SCHOOL", "OTHER"];
const statuses: InstitutionStatus[] = ["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"];

type InstitutionFormValues = {
  name: string;
  acronym: string | null;
  slug: string;
  type: InstitutionType;
  country: string;
  province: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  domain: string | null;
  logoUrl: string | null;
  status?: InstitutionStatus;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function InstitutionForm({
  mode,
  institutionId,
  initial,
  canSetStatus,
}: {
  mode: "create" | "edit";
  institutionId?: string;
  initial?: Partial<InstitutionFormValues>;
  canSetStatus: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const defaults = useMemo(
    () => ({
      name: initial?.name ?? "",
      acronym: initial?.acronym ?? "",
      slug: initial?.slug ?? "",
      type: initial?.type ?? "UNIVERSITY",
      country: initial?.country ?? "CD",
      province: initial?.province ?? "",
      city: initial?.city ?? "",
      address: initial?.address ?? "",
      website: initial?.website ?? "",
      domain: initial?.domain ?? "",
      logoUrl: initial?.logoUrl ?? "",
      status: initial?.status ?? "PENDING",
    }),
    [initial],
  );
  const [slug, setSlug] = useState(defaults.slug);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Enregistrement…");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const body = mode === "edit" ? { action: "update", ...data } : data;
    const response = await fetch(
      mode === "create" ? "/api/admin/institutions" : `/api/admin/institutions/${institutionId}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const result = (await response.json()) as { error?: string; id?: string };
    if (!response.ok) {
      setMessage(result.error ?? "Enregistrement refusé.");
      return;
    }
    setMessage("Enregistré.");
    router.push(`/admin/institutions/${result.id ?? institutionId}`);
    router.refresh();
  }

  return (
    <form className="form-grid glass card admin-institution-form" onSubmit={submit}>
      <label>
        Nom
        <input
          className="input"
          name="name"
          required
          minLength={2}
          defaultValue={defaults.name}
          onChange={(event) => {
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
        />
      </label>
      <label>
        Acronyme
        <input className="input" name="acronym" defaultValue={defaults.acronym} maxLength={40} />
      </label>
      <label>
        Slug
        <input
          className="input"
          name="slug"
          required
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        />
      </label>
      <label>
        Type
        <select className="input" name="type" defaultValue={defaults.type}>
          {types.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Pays
        <input className="input" name="country" required defaultValue={defaults.country} maxLength={80} />
      </label>
      <label>
        Province
        <input className="input" name="province" defaultValue={defaults.province} maxLength={120} />
      </label>
      <label>
        Ville
        <input className="input" name="city" defaultValue={defaults.city} maxLength={120} />
      </label>
      <label>
        Site web
        <input className="input" name="website" type="url" defaultValue={defaults.website} />
      </label>
      <label className="span-2">
        Adresse
        <input className="input" name="address" defaultValue={defaults.address} maxLength={300} />
      </label>
      <label>
        Domaine
        <input className="input" name="domain" defaultValue={defaults.domain} maxLength={120} />
      </label>
      <label>
        Logo (URL)
        <input className="input" name="logoUrl" type="url" defaultValue={defaults.logoUrl} />
      </label>
      {canSetStatus && mode === "create" ? (
        <label>
          Statut initial
          <select className="input" name="status" defaultValue={defaults.status}>
            {statuses.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="span-2 admin-form-actions">
        <button className="button" type="submit">{mode === "create" ? "Créer l’institution" : "Enregistrer"}</button>
        {message ? <p role="status">{message}</p> : null}
      </div>
    </form>
  );
}

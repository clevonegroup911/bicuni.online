import type { ReactNode } from "react";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
      {error ? <small id={`${id}-error`} className="field-error" role="alert">{error}</small> : null}
    </div>
  );
}

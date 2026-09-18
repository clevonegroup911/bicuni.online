"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="button secondary" onClick={() => window.print()}>
      {label}
    </button>
  );
}

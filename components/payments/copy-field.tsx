"use client";

import { useState } from "react";
import { payCopy, type PayLocale } from "@/lib/payments/clevone/locale";

export function CopyField({
  label,
  value,
  locale,
}: {
  label: string;
  value: string;
  locale: PayLocale;
}) {
  const [copied, setCopied] = useState(false);
  const copy = payCopy(locale);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="copy-field">
      <span>{label}</span>
      <code>{value}</code>
      <button type="button" className="button secondary" onClick={() => void onCopy()} aria-live="polite">
        {copied ? copy.copied : copy.copy}
      </button>
    </div>
  );
}

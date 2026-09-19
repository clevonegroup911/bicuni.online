export type SignInFailureKind = "invalid" | "rate_limited" | "temporarily_unavailable" | "mfa_required";

export function signInFailureKind(code: string | undefined): SignInFailureKind {
  if (code === "rate_limited") return "rate_limited";
  if (code === "temporarily_unavailable") return "temporarily_unavailable";
  if (code === "mfa_required") return "mfa_required";
  return "invalid";
}

export function signInFailureMessage(code: string | undefined, admin = false) {
  const kind = signInFailureKind(code);
  if (kind === "temporarily_unavailable") return "Connexion momentanément indisponible. Réessayez.";
  if (kind === "rate_limited") return "Trop de tentatives. Réessayez plus tard.";
  if (kind === "mfa_required") return "Code MFA requis.";
  return admin
    ? "Identifiants invalides ou accès administratif indisponible."
    : "Identifiants invalides ou adresse email non vérifiée.";
}

export type WriteApiKind = "session" | "missing" | "validation" | "forbidden" | "unavailable" | "conflict";

export type WriteApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: WriteApiKind; message: string; fields?: Record<string, string> };

const SESSION_MESSAGE = "Votre session a expiré. Reconnectez-vous pour continuer.";
const MISSING_MESSAGE = "Cette action n’est pas encore disponible : l’API serveur correspondante n’est pas exposée.";
const FORBIDDEN_MESSAGE = "Vous n’avez pas l’autorisation d’effectuer cette action.";
const UNAVAILABLE_MESSAGE = "Service momentanément indisponible. Réessayez plus tard.";
const VALIDATION_MESSAGE = "Les informations saisies n’ont pas pu être enregistrées.";

export function sessionLoginHref(nextPath: string) {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function interpretWriteStatus(status: number, error?: string): Exclude<WriteApiResult<never>, { ok: true }> {
  if (status === 401) return { ok: false, kind: "session", message: error || SESSION_MESSAGE };
  if (status === 403) return { ok: false, kind: "forbidden", message: error || FORBIDDEN_MESSAGE };
  if (status === 404 || status === 405 || status === 501) {
    return { ok: false, kind: "missing", message: error || MISSING_MESSAGE };
  }
  if (status === 409) return { ok: false, kind: "conflict", message: error || VALIDATION_MESSAGE };
  if (status === 400 || status === 422) return { ok: false, kind: "validation", message: error || VALIDATION_MESSAGE };
  return { ok: false, kind: "unavailable", message: error || UNAVAILABLE_MESSAGE };
}

export async function parseWriteResponse<T>(response: Response): Promise<WriteApiResult<T>> {
  const payload = await response.json().catch(() => ({})) as {
    error?: string;
    fields?: Record<string, string>;
  } & T;
  if (!response.ok) {
    const interpreted = interpretWriteStatus(response.status, payload.error);
    return { ...interpreted, fields: payload.fields };
  }
  return { ok: true, data: payload };
}

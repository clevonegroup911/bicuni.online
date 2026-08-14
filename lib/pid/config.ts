import { PersistentIdentifierError } from "./errors";
import { PID_INTERNAL_PREFIX } from "./types";

const DEFAULT_PUBLIC_APP_URL = "https://bicuni.online";

export function assertPidRuntimeConfig() {
  const scheme = process.env.BICUNI_PID_SCHEME?.trim();
  if (scheme && scheme !== "BICUNI_PID") {
    throw new PersistentIdentifierError(
      "BICUNI_PID_SCHEME=DOI est interdit. Seul BICUNI_PID est accepté. Un DOI réel nécessitera un module registrar distinct.",
      500,
    );
  }
  const prefix = process.env.BICUNI_PID_PREFIX?.trim();
  if (prefix && prefix !== PID_INTERNAL_PREFIX) {
    throw new PersistentIdentifierError(
      "Seul le préfixe interne bcu est autorisé. Les préfixes 10.x, 10.bcu et tout mode DOI local sont interdits.",
      500,
    );
  }
}

export function pidPrefix() {
  assertPidRuntimeConfig();
  return PID_INTERNAL_PREFIX;
}

export function pidScheme(): "BICUNI_PID" {
  assertPidRuntimeConfig();
  return "BICUNI_PID";
}

export function publicAppUrl() {
  const raw = process.env.APP_URL?.trim() || DEFAULT_PUBLIC_APP_URL;
  return raw.replace(/\/+$/, "");
}

export function buildResolverUrl(identifier: string) {
  return `${publicAppUrl()}/pid/${identifier}`;
}

export function pidAllowedHosts() {
  const extra = (process.env.BICUNI_PID_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const hosts = new Set<string>(["bicuni.online", "*.bicuni.online", ...extra]);
  try {
    const appHost = new URL(publicAppUrl()).hostname.toLowerCase();
    if (appHost) hosts.add(appHost);
  } catch {
    /* APP_URL invalide : les hôtes par défaut restent applicables. */
  }
  return [...hosts];
}

export function pidRequireHttps() {
  return process.env.NODE_ENV === "production";
}

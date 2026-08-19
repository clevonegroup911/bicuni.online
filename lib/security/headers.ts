const normalizeOrigin = (value: string | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
};

const configuredPublicOrigin = () => {
  const value = process.env.PUBLIC_APP_URL?.trim() || process.env.AUTH_URL?.trim() || process.env.APP_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

export const HSTS_VALUE = "max-age=31536000; includeSubDomains";

/**
 * Residual CSP exception:
 * `style-src 'unsafe-inline'` remains because the UI still emits style attributes
 * (`style={{ ... }}`) that cannot be covered by a nonce. Script `unsafe-inline`
 * is omitted in production when a request nonce is provided.
 */
export function contentSecurityPolicy(environment = process.env.NODE_ENV, nonce?: string) {
  const development = environment !== "production";
  const storageOrigin = normalizeOrigin(process.env.GCS_PUBLIC_ORIGIN);
  const imageSources = ["'self'", "data:", "blob:", "https://storage.googleapis.com"];
  const frameSources = ["'self'", "blob:", "https://js.stripe.com", "https://hooks.stripe.com", "https://storage.googleapis.com"];
  if (storageOrigin) {
    imageSources.push(storageOrigin);
    frameSources.push(storageOrigin);
  }

  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""} https://js.stripe.com`
    : `script-src 'self'${development ? " 'unsafe-inline' 'unsafe-eval'" : ""} https://js.stripe.com`;

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com",
    `frame-src ${frameSources.join(" ")}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob: https://storage.googleapis.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
  ];
  if (!development && configuredPublicOrigin()?.protocol === "https:") {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

export function nextRendererCspHeaders(nonce: string, environment = process.env.NODE_ENV) {
  return {
    "x-nonce": nonce,
    "Content-Security-Policy": contentSecurityPolicy(environment, nonce),
  } as const;
}

export function staticSecurityHeaders() {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\")" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
}

export function shouldSendHsts(environment = process.env.NODE_ENV, https = false) {
  return environment === "production" && https;
}

export function securityHeaders(
  environment = process.env.NODE_ENV,
  options: { nonce?: string; https?: boolean } = {},
) {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(environment, options.nonce) },
    ...staticSecurityHeaders(),
  ];
  if (shouldSendHsts(environment, options.https === true)) {
    headers.push({ key: "Strict-Transport-Security", value: HSTS_VALUE });
  }
  return headers;
}

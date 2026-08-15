const normalizeOrigin = (value: string | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
};

export function contentSecurityPolicy(environment = process.env.NODE_ENV) {
  const development = environment !== "production";
  const storageOrigin = normalizeOrigin(process.env.GCS_PUBLIC_ORIGIN);
  const imageSources = ["'self'", "data:", "blob:", "https://storage.googleapis.com"];
  const frameSources = ["'self'", "blob:", "https://js.stripe.com", "https://hooks.stripe.com", "https://storage.googleapis.com"];
  if (storageOrigin) {
    imageSources.push(storageOrigin);
    frameSources.push(storageOrigin);
  }

  const directives = [
    "default-src 'self'",
    // Next.js currently emits inline bootstrap scripts. Remove unsafe-inline after nonce propagation is adopted.
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
    // Next.js and the current UI emit style attributes. Keep this exception scoped to styles.
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
  if (!development) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function securityHeaders(environment = process.env.NODE_ENV) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(environment) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\")" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
}

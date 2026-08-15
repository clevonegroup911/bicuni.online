const DEFAULT_PRODUCTION_ORIGIN = "https://bicuni.online";

export function publicOrigin(request: Request) {
  const configured = process.env.AUTH_URL?.trim() || process.env.APP_URL?.trim();
  if (!configured) {
    return process.env.NODE_ENV === "production"
      ? DEFAULT_PRODUCTION_ORIGIN
      : new URL(request.url).origin;
  }

  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("AUTH_URL/APP_URL doit utiliser HTTP ou HTTPS.");
  }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !loopback) {
    throw new Error("AUTH_URL/APP_URL doit utiliser HTTPS en production.");
  }
  return url.origin;
}

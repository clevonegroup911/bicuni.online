export function nativeFormNavigationUrl(input: {
  method: string;
  action?: string;
  pageUrl: string;
  fields: Record<string, string>;
}) {
  const method = input.method.trim().toLowerCase() || "get";
  const url = new URL(input.action || input.pageUrl, input.pageUrl);
  if (method !== "post") {
    for (const [key, value] of Object.entries(input.fields)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

export function urlExposesSecrets(href: string, secrets: string[]) {
  return secrets.some((secret) => Boolean(secret) && href.includes(secret));
}

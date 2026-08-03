type LogLevel = "info" | "warn" | "error";
type Metadata = Record<string, unknown>;

const sensitiveKey = /(password|secret|token|authorization|cookie|card|signed.?url|upload.?url|download.?url)/i;

function safeValue(key: string, value: unknown): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (value instanceof Error) return { name: value.name, message: redactText(value.message) };
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => safeValue(key, item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, safeValue(childKey, childValue)]));
  }
  return value;
}

function redactText(value: string) {
  return value.replace(/https?:\/\/\S+/gi, "[URL_REDACTED]").slice(0, 2_000);
}

function write(level: LogLevel, event: string, metadata: Metadata = {}) {
  const sanitized = safeValue("metadata", metadata) as Metadata;
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...sanitized });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export const logger = {
  info: (event: string, metadata?: Metadata) => write("info", event, metadata),
  warn: (event: string, metadata?: Metadata) => write("warn", event, metadata),
  error: (event: string, error: unknown, metadata?: Metadata) => write("error", event, { ...metadata, error }),
};

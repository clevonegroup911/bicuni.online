import { pidPrefix } from "./config";
import { PersistentIdentifierError } from "./errors";
import { isPidSuffixType, PID_SUFFIX_TYPE_CODES, type PidSuffixType } from "./types";
import { generateUlid } from "./ulid";

export function generatePersistentIdentifier(
  suffixType: PidSuffixType,
  _resourceId?: string,
  now = new Date(),
) {
  if (!isPidSuffixType(suffixType)) {
    throw new PersistentIdentifierError("suffixType d’identifiant invalide.", 400);
  }
  const prefix = pidPrefix();
  const suffix = generatePersistentIdentifierSuffix(suffixType, now);
  return {
    prefix,
    suffix,
    identifier: `${prefix}/${suffix}`,
  };
}

export function generatePersistentIdentifierSuffix(suffixType: PidSuffixType, now = new Date()) {
  if (!isPidSuffixType(suffixType)) {
    throw new PersistentIdentifierError("suffixType d’identifiant invalide.", 400);
  }
  const year = now.getUTCFullYear();
  const typeCode = PID_SUFFIX_TYPE_CODES[suffixType];
  return `${year}.${typeCode}.${generateUlid(now.getTime())}`;
}

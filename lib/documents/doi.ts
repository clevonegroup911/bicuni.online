/** Préfixe historiquement généré automatiquement — jamais un DOI enregistré. */
export const SYNTHETIC_BICUNI_DOI_PREFIX = "10.87878/bicuni.";

/** BICUNI PID interne : ne doit jamais être stocké ni exposé comme DOI. */
const BICUNI_PID_VALUE = /^(?:bcu|10\.bcu)\//i;

export function isSyntheticBicuniDoi(value: string | null | undefined) {
  return Boolean(value?.startsWith(SYNTHETIC_BICUNI_DOI_PREFIX));
}

export function isBicuniPersistentIdentifier(value: string | null | undefined) {
  return Boolean(value?.trim() && BICUNI_PID_VALUE.test(value.trim()));
}

function isUnregisteredDoiLookalike(value: string) {
  return isSyntheticBicuniDoi(value) || isBicuniPersistentIdentifier(value);
}

/**
 * Retourne un DOI réellement stocké, ou null.
 * Les identifiants synthétiques 10.87878/bicuni.* et les BICUNI PID (bcu/…, 10.bcu/…) ne sont jamais exposés.
 */
export function registeredDoi(internalDoi: string | null | undefined): string | null {
  if (!internalDoi?.trim()) return null;
  const value = internalDoi.trim();
  if (isUnregisteredDoiLookalike(value)) return null;
  return value;
}

/**
 * Politique d’écriture à l’approbation :
 * absent → null ; synthétique 10.87878/bicuni.* → null ; BICUNI PID → null ; DOI réel → conservé.
 */
export function internalDoiForApproval(existing: string | null | undefined): string | null {
  if (!existing?.trim()) return null;
  const value = existing.trim();
  if (isUnregisteredDoiLookalike(value)) return null;
  return value;
}

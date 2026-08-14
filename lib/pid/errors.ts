export class PersistentIdentifierError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export class PidBoundResourceError extends PersistentIdentifierError {
  constructor() {
    super("Impossible de supprimer une ressource référencée par un identifiant pérenne.", 409);
  }
}

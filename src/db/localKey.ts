/**
 * The encrypted local database exists but its key is gone (reinstall, restore
 * from a backup, a new phone). The data is unreadable; for a real account the
 * synced copy lives in the cloud and can be downloaded again.
 */
export class LocalKeyMissingError extends Error {
  constructor() {
    super(
      "No se encuentra la clave de la base local de este teléfono. Puedes restaurarla desde tu cuenta en la nube; lo que no se haya sincronizado antes se perderá.",
    );
    this.name = "LocalKeyMissingError";
  }
}
export const isLocalKeyMissing = (e: unknown): e is LocalKeyMissingError =>
  e instanceof LocalKeyMissingError;

import { defaultDatabaseDirectory, openDatabaseAsync } from "expo-sqlite";
import { File } from "expo-file-system";
import { getRandomBytesAsync, randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Repository } from "./Repository";
export function repositoryStorage(userId: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(userId))
    throw new Error("Identidad local inválida");
  if (!defaultDatabaseDirectory)
    throw new Error("Almacén nativo no disponible");
  // expo-sqlite returns a plain absolute path on Android. FileSystem requires
  // a file URI; leave SQLite's own directory unchanged for openDatabaseAsync.
  const directoryUri = defaultDatabaseDirectory.startsWith("file://")
    ? defaultDatabaseDirectory
    : `file://${defaultDatabaseDirectory}`;
  const databaseName = `apisense-encrypted-v1-${userId}.db`;
  return {
    directoryUri,
    databaseName,
    keyName: `apisense.db-key.${userId}`,
    file: new File(directoryUri, databaseName),
  };
}
export async function openRepository(userId: string) {
  const { keyName, databaseName, file } = repositoryStorage(userId);
  let key = await SecureStore.getItemAsync(keyName);
  if (!key) {
    // A restore/reinstall can leave ciphertext without its device-bound key.
    // Preserve it for recovery; never replace the key or reset the database.
    if (file.exists)
      throw new Error(
        "No se encuentra la clave de esta base local. No se modificaron tus datos. Conserva la instalación y solicita recuperación antes de borrar o reinstalar.",
      );
    key = Array.from(await getRandomBytesAsync(32), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join("");
    await SecureStore.setItemAsync(keyName, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error("Clave local dañada");
  const db = await openDatabaseAsync(databaseName, {
    useNewConnection: true,
  });
  try {
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    const cipher = await db.getFirstAsync<{ cipher_version: string }>(
      "PRAGMA cipher_version",
    );
    if (!cipher?.cipher_version)
      throw new Error(
        "Se requiere un build de desarrollo con SQLCipher. No se guardarán datos sin cifrar.",
      );
    const repository = new Repository(
      {
        exec: (sql) => db.execAsync(sql),
        run: (sql, params = []) => db.runAsync(sql, params),
        all: (sql, params = []) => db.getAllAsync(sql, params),
        close: () => db.closeAsync(),
      },
      randomUUID,
    );
    await repository.initialize();
    return repository;
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
}
/**
 * Deliberately erases this account's local database and its key (account
 * deletion). Unlike openRepository, which never discards data, this is only
 * called after the server confirmed the account is gone.
 */
export async function eraseLocalData(userId: string) {
  const { directoryUri, databaseName, keyName } = repositoryStorage(userId);
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = new File(directoryUri, databaseName + suffix);
    if (file.exists) file.delete();
  }
  await SecureStore.deleteItemAsync(keyName);
}

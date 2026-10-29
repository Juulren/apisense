import { openDatabaseAsync } from "expo-sqlite";
import { getRandomBytesAsync, randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Repository } from "./Repository";
export async function openRepository(userId: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(userId))
    throw new Error("Identidad local inválida");
  const keyName = `apisense.db-key.${userId}`;
  let key = await SecureStore.getItemAsync(keyName);
  if (!key) {
    key = Array.from(await getRandomBytesAsync(32), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join("");
    await SecureStore.setItemAsync(keyName, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error("Clave local dañada");
  const db = await openDatabaseAsync(`apisense-encrypted-v1-${userId}.db`, {
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

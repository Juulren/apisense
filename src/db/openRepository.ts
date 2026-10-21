import { deserializeDatabaseAsync, openDatabaseAsync } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import { Repository } from "./Repository";
import { deriveLocalKey, sealSnapshot, unsealSnapshot } from "./encryption";
import { readSnapshot, writeSnapshot } from "./webVault";
import { acquireWebDatabaseLock } from "./webLock";
export async function openRepository(userId: string, passphrase?: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(userId))
    throw new Error("Identidad local inválida");
  const demo = userId === "00000000-0000-4000-8000-000000000001";
  const release = demo ? async () => {} : await acquireWebDatabaseLock(userId);
  try {
    const snapshot = demo ? undefined : await readSnapshot(userId);
    const salt = snapshot?.salt ?? crypto.getRandomValues(new Uint8Array(16));
    const key = demo ? null : await deriveLocalKey(passphrase ?? "", salt);
    let db =
      snapshot && key
        ? await deserializeDatabaseAsync(
            await unsealSnapshot(snapshot, key, userId),
          )
        : await openDatabaseAsync(demo ? `apisense-${userId}.db` : ":memory:", {
            useNewConnection: !demo,
          });
    let backup: Uint8Array | null = null;
    const repository = new Repository(
      {
        exec: async (sql) => {
          if (!key) {
            await db.execAsync(sql);
            return;
          }
          if (sql === "BEGIN IMMEDIATE") backup = await db.serializeAsync();
          if (sql === "ROLLBACK") {
            if (await db.isInTransactionAsync()) await db.execAsync(sql);
            backup = null;
            return;
          }
          await db.execAsync(sql);
          if (sql === "COMMIT") {
            try {
              await writeSnapshot(
                userId,
                await sealSnapshot(
                  await db.serializeAsync(),
                  key,
                  salt,
                  userId,
                ),
              );
              backup = null;
            } catch (error) {
              if (backup) {
                await db.closeAsync();
                db = await deserializeDatabaseAsync(backup);
                await db.execAsync("PRAGMA foreign_keys=ON");
                backup = null;
              }
              throw error;
            }
          }
        },
        run: (sql, params = []) => db.runAsync(sql, params),
        all: (sql, params = []) => db.getAllAsync(sql, params),
        close: async () => {
          try {
            await db.closeAsync();
          } finally {
            await release();
          }
        },
      },
      randomUUID,
    );
    await repository.initialize();
    return repository;
  } catch (error) {
    await release();
    throw error;
  }
}

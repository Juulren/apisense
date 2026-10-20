import type { EncryptedSnapshot } from "./encryption";
async function openVault() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("apisense-encrypted-v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("snapshots");
      request.result.createObjectStore("principals");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly"),
      request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
async function write(store: string, key: string, value: unknown) {
  const db = await openVault();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("No se pudo guardar el cifrado local"));
    };
  });
}
export const readSnapshot = (principal: string) =>
  read<EncryptedSnapshot>("snapshots", principal);
export const writeSnapshot = (principal: string, snapshot: EncryptedSnapshot) =>
  write("snapshots", principal, snapshot);
const emailKey = async (email: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(email.trim().toLowerCase()),
      ),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
export async function rememberWebPrincipal(email: string, id: string) {
  await write("principals", await emailKey(email), id);
}
export async function findWebPrincipal(email: string) {
  return read<string>("principals", await emailKey(email));
}

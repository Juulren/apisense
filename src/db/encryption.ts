export type EncryptedSnapshot = {
  version: 1;
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
};
export async function deriveLocalKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  if (passphrase.length < 16)
    throw new Error("La clave local debe tener al menos 16 caracteres");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: 600000,
      salt: Uint8Array.from(salt),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function sealSnapshot(
  bytes: Uint8Array,
  key: CryptoKey,
  salt: Uint8Array,
  principal: string,
): Promise<EncryptedSnapshot> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(`apisense-v1:${principal}`),
    },
    key,
    Uint8Array.from(bytes),
  );
  return { version: 1, salt, iv, ciphertext };
}
export async function unsealSnapshot(
  snapshot: EncryptedSnapshot,
  key: CryptoKey,
  principal: string,
): Promise<Uint8Array> {
  if (
    snapshot.version !== 1 ||
    snapshot.iv.length !== 12 ||
    snapshot.salt.length !== 16
  )
    throw new Error("Formato de datos cifrados incompatible");
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: Uint8Array.from(snapshot.iv),
          additionalData: new TextEncoder().encode(`apisense-v1:${principal}`),
        },
        key,
        snapshot.ciphertext,
      ),
    );
  } catch {
    throw new Error("Clave local incorrecta o datos cifrados dañados");
  }
}

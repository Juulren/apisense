import { randomUUID } from "expo-crypto";
import { openRepository } from "./openRepository";
export async function verifyEncryptedStorage() {
  const principal = randomUUID(),
    passphrase = "clave exclusiva de prueba local";
  const first = await openRepository(principal, passphrase);
  const apiary = await first.save("apiaries", {
    user_id: principal,
    name: "Prueba cifrada temporal",
    latitude: null,
    longitude: null,
    check_interval_minutes: 15,
  });
  let concurrencyRejected = false;
  try {
    const duplicate = await openRepository(principal, passphrase);
    await duplicate.close();
  } catch {
    concurrencyRejected = true;
  }
  if (!concurrencyRejected)
    throw new Error("El almacén permitió dos sesiones simultáneas");
  await first.close();
  let rejected = false;
  try {
    const wrong = await openRepository(
      principal,
      "una clave incorrecta de prueba",
    );
    await wrong.close();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("El almacén aceptó una clave incorrecta");
  const reopened = await openRepository(principal, passphrase);
  try {
    if (
      (await reopened.get("apiaries", apiary.id))?.name !==
      "Prueba cifrada temporal"
    )
      throw new Error("No se conservó la escritura cifrada");
  } finally {
    await reopened.close();
  }
  return "Cifrado comprobado: escritura durable, reapertura, rechazo de clave incorrecta y bloqueo de sesiones simultáneas.";
}

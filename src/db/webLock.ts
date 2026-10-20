export async function acquireWebDatabaseLock(
  principal: string,
): Promise<() => Promise<void>> {
  if (!navigator.locks)
    throw new Error(
      "Este navegador no admite el bloqueo seguro de la base local",
    );
  let unlock!: () => void;
  const released = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  let accepted!: () => void;
  let declined!: (error: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    accepted = resolve;
    declined = reject;
  });
  const held = navigator.locks.request(
    `apisense-database-${principal}`,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (!lock)
        throw new Error(
          "Esta cuenta ya está abierta en otra pestaña. Ciérrala antes de continuar.",
        );
      accepted();
      await released;
    },
  );
  void held.catch(declined);
  await ready;
  return async () => {
    unlock();
    await held;
  };
}

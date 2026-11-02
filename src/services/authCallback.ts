export const AUTH_REDIRECT_URL = "apisense://auth/callback";

export function authCallbackCode(raw: string): string {
  const invalid = () =>
    new Error(
      "Enlace de confirmación inválido. Solicita uno nuevo desde la app.",
    );
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid();
  }
  // Accept only the registered native callback. Never import bearer tokens from
  // arbitrary deep links; the SDK exchanges a code using this device's verifier.
  if (
    url.protocol !== "apisense:" ||
    url.hostname !== "auth" ||
    url.pathname !== "/callback" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.searchParams.has("access_token") ||
    url.searchParams.has("refresh_token")
  )
    throw invalid();
  if (url.searchParams.has("error") || url.searchParams.has("error_code"))
    throw new Error(
      "La confirmación caducó o fue rechazada. Solicita un enlace nuevo.",
    );
  const codes = url.searchParams.getAll("code");
  if (codes.length !== 1 || !codes[0]?.trim() || codes[0].length > 4096)
    throw invalid();
  return codes[0];
}

// React navigation may mount twice for the same cold/warm deep link. An auth
// code is single-use, so concurrent deliveries must share one exchange.
export function createAuthCallbackHandler(
  exchange: (code: string) => Promise<void>,
) {
  const attempts = new Map<string, Promise<void>>();
  return (raw: string) => {
    const code = authCallbackCode(raw);
    const existing = attempts.get(code);
    if (existing) return existing;
    if (attempts.size >= 8) attempts.delete(attempts.keys().next().value!);
    const task = Promise.resolve().then(() => exchange(code));
    attempts.set(code, task);
    void task.then(
      () => {
        // Bounded memory; no URL or token is persisted or logged.
        // Retain successful exchanges to absorb navigation re-deliveries.
      },
      () => {
        attempts.delete(code);
      },
    );
    return task;
  };
}

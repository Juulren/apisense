/** What the person is told when signing in or up fails: never the technical text. */
export function authMessage(error: unknown, action: "login" | "register") {
  const e = (error ?? {}) as { code?: string; name?: string; message?: string };
  const text = `${e.code ?? ""} ${e.name ?? ""} ${e.message ?? ""}`;
  if (/AuthRetryableFetchError|network|failed to fetch|timed? ?out/i.test(text))
    return "No hay conexión. Para entrar necesitas internet.";
  if (/invalid_credentials|invalid login credentials/i.test(text))
    return "Correo o contraseña incorrectos.";
  if (/email_not_confirmed|email not confirmed/i.test(text))
    return "Confirma tu correo antes de entrar.";
  if (/user_already_exists|already registered/i.test(text))
    return "Ese correo ya tiene cuenta.";
  if (/rate.?limit|too many requests/i.test(text))
    return "Demasiados intentos. Espera un momento.";
  if (/weak_password|pwned|compromised|easy to guess|weak and easy/i.test(text))
    return "Esa contraseña es demasiado débil; elige otra.";
  return action === "login"
    ? "No se pudo entrar. Inténtalo de nuevo."
    : "No se pudo crear la cuenta. Inténtalo de nuevo.";
}

/** For a build without a server configured. */
export const NO_ACCOUNTS =
  "Esta versión no puede entrar a una cuenta. Puedes probar la demo.";

/** Signed in, or already saved, but this phone's data would not open. */
export const OPEN_FAILED =
  "No se pudieron abrir los datos de este teléfono. Cierra la app y vuelve a abrirla.";

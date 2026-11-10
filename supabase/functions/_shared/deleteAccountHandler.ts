// Deletes the signed-in user's account and everything it owns. It is the only
// place the service role touches user data for this purpose, so it checks, in
// order: a valid session, the password again (a stolen or forgotten-open session
// must not be enough), then removes files, rows and finally the auth user.
// Every step is safe to repeat, so a failure half way is fixed by trying again.
const MAX_BODY = 4096;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export interface DeleteAccountDependencies {
  /** Validates the bearer token and returns who it belongs to. */
  authenticate(jwt: string): Promise<{ id: string; email: string } | null>;
  /** Re-checks the password with a throwaway client (no session is kept). */
  passwordIsCorrect(email: string, password: string): Promise<boolean>;
  /** Removes every Storage object under `hive-audio/<userId>/`. */
  purgeStorage(userId: string): Promise<void>;
  /** Removes every row the user owns, child tables first. */
  deleteData(userId: string): Promise<void>;
  /** Deletes the auth user (and with it the profile). */
  deleteUser(userId: string): Promise<void>;
}

export function createDeleteAccountHandler(deps: DeleteAccountDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST")
      return json({ error: "Método no permitido" }, 405);
    const match = request.headers
      .get("authorization")
      ?.match(/^Bearer\s+([A-Za-z0-9._-]+)$/);
    if (!match?.[1]) return json({ error: "Inicia sesión de nuevo" }, 401);
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: "Solicitud inválida" }, 413);
    let password: unknown;
    try {
      password = (JSON.parse(text) as { password?: unknown }).password;
    } catch {
      return json({ error: "Solicitud inválida" }, 400);
    }
    if (typeof password !== "string" || password.length === 0 || password.length > 256)
      return json({ error: "Escribe tu contraseña para confirmar" }, 400);

    try {
      const user = await deps.authenticate(match[1]);
      if (!user) return json({ error: "Inicia sesión de nuevo" }, 401);
      if (!(await deps.passwordIsCorrect(user.email, password)))
        return json({ error: "La contraseña no es correcta" }, 403);
      await deps.purgeStorage(user.id);
      await deps.deleteData(user.id);
      await deps.deleteUser(user.id);
      return json({ status: "deleted" });
    } catch {
      // Nothing about the failure is sent back; the user can simply try again.
      return json(
        { error: "No se pudo borrar la cuenta. Inténtalo de nuevo en un momento." },
        500,
      );
    }
  };
}

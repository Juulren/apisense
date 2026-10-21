export function supabaseConfig(env = process.env) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Faltan las variables EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env",
    );
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL de Supabase inválida");
  }
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
  ) {
    throw new Error("Supabase requiere HTTPS, salvo en localhost");
  }
  if (key.startsWith("eyJ")) {
    let role;
    try {
      role = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      ).role;
    } catch {
      /* Reject below. */
    }
    if (role !== "anon")
      throw new Error("El cliente solo puede utilizar una clave pública anon");
  } else if (!key.startsWith("sb_publishable_")) {
    throw new Error(
      "El cliente requiere una clave Publishable; no uses claves secretas",
    );
  }
  return { url: parsed.origin, key };
}

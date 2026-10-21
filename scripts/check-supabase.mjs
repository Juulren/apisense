import { supabaseConfig } from "./supabase-config.mjs";

try {
  const { url, key } = supabaseConfig();
  const checks = [
    { name: "Auth", path: "/auth/v1/settings", accepted: [200] },
    ...[
      "apiaries",
      "hives",
      "iot_microphones",
      "audio_samples",
      "ai_summaries",
      "inspections",
    ].map((table) => ({
      name: `Tabla ${table}`,
      path: `/rest/v1/${table}?select=id&limit=0`,
      accepted: [200, 401, 403],
    })),
    {
      name: "Función: rechaza llamadas sin sesión",
      path: "/functions/v1/generate-hive-summary",
      accepted: [401],
      method: "POST",
    },
  ];
  for (const check of checks) {
    try {
      const response = await fetch(url + check.path, {
        method: check.method ?? "GET",
        headers: { apikey: key, "Content-Type": "application/json" },
        ...(check.method ? { body: "{}" } : {}),
        signal: AbortSignal.timeout(15000),
      });
      const ok = check.accepted.includes(response.status);
      console.log(
        `${ok ? "OK" : "PENDIENTE"} — ${check.name} (HTTP ${response.status})`,
      );
      if (!ok) process.exitCode = 1;
    } catch {
      console.log(`PENDIENTE — ${check.name}: no se pudo conectar`);
      process.exitCode = 1;
    }
  }
  console.log(
    "Esta comprobación no sustituye las pruebas multiusuario, Storage y cron.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

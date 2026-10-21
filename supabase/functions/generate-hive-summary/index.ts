import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createSummaryHandler } from "../_shared/summaryHandler.ts";

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
function serverKey(privileged: boolean) {
  const keys = Deno.env.get(
    privileged ? "SUPABASE_SECRET_KEYS" : "SUPABASE_PUBLISHABLE_KEYS",
  );
  if (keys) {
    const configured = JSON.parse(keys);
    if (typeof configured.default === "string") return configured.default;
  }
  return required(
    privileged ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY",
  );
}
Deno.serve(
  createSummaryHandler({
    cronSecret: () => Deno.env.get("CRON_SECRET"),
    client: (privileged, authorization) =>
      createClient(required("SUPABASE_URL"), serverKey(privileged), {
        auth: { persistSession: false, autoRefreshToken: false },
        ...(authorization
          ? { global: { headers: { Authorization: authorization } } }
          : {}),
      }),
  }),
);

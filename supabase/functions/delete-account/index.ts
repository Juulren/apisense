import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createDeleteAccountHandler } from "../_shared/deleteAccountHandler.ts";

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
function serviceKey() {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const configured = JSON.parse(keys);
    if (typeof configured.default === "string") return configured.default;
  }
  return required("SUPABASE_SERVICE_ROLE_KEY");
}
const url = required("SUPABASE_URL");
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
// Service key: used only to validate the caller's token, clear their data and
// delete their auth user. It never leaves this function.
const admin = createClient(url, serviceKey(), noSession);
const BUCKET = "hive-audio";

// Objects live at <user>/<hive>/<file>; walk the two levels and remove in batches.
async function listFiles(prefix: string, depth: number): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, offset });
    if (error) throw error;
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null && depth > 0)
        files.push(...(await listFiles(path, depth - 1)));
      else if (entry.id !== null) files.push(path);
    }
    if (!data || data.length < 100) return files;
  }
}

Deno.serve(
  createDeleteAccountHandler({
    async authenticate(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      if (error || !data.user?.email) return null;
      return { id: data.user.id, email: data.user.email };
    },
    async passwordIsCorrect(email, password) {
      const anon = createClient(
        url,
        Deno.env.get("SUPABASE_ANON_KEY") ?? required("SUPABASE_PUBLISHABLE_KEY"),
        noSession,
      );
      const { error } = await anon.auth.signInWithPassword({ email, password });
      // The check must not leave a usable session behind.
      if (!error) await anon.auth.signOut().catch(() => {});
      return !error;
    },
    async purgeStorage(userId) {
      const files = await listFiles(userId, 2);
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await admin.storage
          .from(BUCKET)
          .remove(files.slice(i, i + 100));
        if (error) throw error;
      }
    },
    async deleteData(userId) {
      const { error } = await admin.rpc("delete_account_data", {
        target: userId,
      });
      if (error) throw error;
    },
    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      // Already gone (a retry after a partial run) counts as done.
      if (error && error.status !== 404) throw error;
    },
  }),
);

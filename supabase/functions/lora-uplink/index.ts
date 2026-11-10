import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  createLoraUplinkHandler,
  type VerdictInsert,
} from "../_shared/loraUplinkHandler.ts";

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
// The service key never leaves this function and is used only for these three
// narrow operations: look up a node, check its hive, insert one verdict.
const client = createClient(required("SUPABASE_URL"), serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(
  createLoraUplinkHandler({
    secret: () => Deno.env.get("LORA_UPLINK_SECRET"),
    async findNode(devEui) {
      const { data, error } = await client
        .from("iot_microphones")
        .select("id,hive_id")
        .eq("dev_eui", devEui)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async hiveIsLive(hiveId) {
      const { data, error } = await client
        .from("hives")
        .select("id")
        .eq("id", hiveId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async insertVerdict(row: VerdictInsert) {
      const { data, error } = await client
        .from("edge_verdicts")
        .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      return data && data.length > 0 ? "stored" : "duplicate";
    },
  }),
);

import { supabase } from "./supabase";

let lastToken: string | null = null;
export const rememberPushToken = (token: string | null) => {
  lastToken = token;
};

/**
 * Removes this phone's token from the signed-in account (call before signing
 * out). The token is forgotten only once the server confirmed, so a failed
 * attempt (no signal) can be retried at the next sign-out.
 */
export async function releasePushToken() {
  if (!supabase || !lastToken) return;
  const { error } = await supabase.from("push_tokens").delete().eq("token", lastToken);
  if (!error) lastToken = null;
}

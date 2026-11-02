import "react-native-url-polyfill/auto";
import "./installAuthCrypto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { DEMO_ONLY } from "../config/runtime";
import { createAuthCallbackHandler } from "./authCallback";

const storage = {
  async getItem(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(key);
  },
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const secureUrl =
  url &&
  (url.startsWith("https://") ||
    (__DEV__ && /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url)));
export const supabase =
  !DEMO_ONLY && secureUrl && key
    ? createClient(url, key, {
        auth: {
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : null;

export const completeAuthCallback = createAuthCallbackHandler(async (code) => {
  if (!supabase) throw new Error("Configura Supabase en la app de campo.");
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session)
    throw new Error(
      "No se pudo confirmar la sesión. Abre el enlace en el dispositivo donde creaste la cuenta o solicita uno nuevo.",
    );
});

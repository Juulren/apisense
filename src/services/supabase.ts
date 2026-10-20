import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const webAuthMemory = new Map<string, string>();
const storage = {
  async getItem(key: string) {
    return Platform.OS === "web"
      ? (webAuthMemory.get(key) ?? null)
      : SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") webAuthMemory.set(key, value);
    else
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") webAuthMemory.delete(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const secureUrl =
  url &&
  (url.startsWith("https://") ||
    (__DEV__ && /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url)));
export const supabase =
  secureUrl && key
    ? createClient(url, key, {
        auth: {
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === "web",
        },
      })
    : null;

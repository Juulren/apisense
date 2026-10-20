import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const storage = {
  async getItem(key: string) { return Platform.OS === 'web' ? (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)) : SecureStore.getItemAsync(key); },
  async setItem(key: string, value: string) { if (Platform.OS === 'web') localStorage.setItem(key,value); else await SecureStore.setItemAsync(key,value); },
  async removeItem(key: string) { if (Platform.OS === 'web') localStorage.removeItem(key); else await SecureStore.deleteItemAsync(key); },
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url,key,{ auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web' } }) : null;

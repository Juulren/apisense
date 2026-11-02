// Expo replaces this literal at bundle time. Demo binaries never create a cloud client.
export const DEMO_ONLY = process.env.EXPO_PUBLIC_DEMO_ONLY === "1";
// Explicit opt-in for synthetic native checks; never enabled in a field build.
export const SECURITY_QA =
  DEMO_ONLY && process.env.EXPO_PUBLIC_SECURITY_QA === "1";

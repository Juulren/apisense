// Expo replaces this literal at bundle time. Demo binaries never create a cloud client.
export const DEMO_ONLY = process.env.EXPO_PUBLIC_DEMO_ONLY === "1";

const fs = require("node:fs");

// Push notifications need a Firebase file the owner provides (never committed).
// Without it the app is built exactly as before and alerts stay inside the app.
function withPush(config) {
  const file = process.env.GOOGLE_SERVICES_JSON;
  if (process.env.EXPO_PUBLIC_PUSH_ENABLED !== "1" || !file || !fs.existsSync(file))
    return config;
  return {
    ...config,
    android: { ...config.android, googleServicesFile: file },
    plugins: [
      ...(config.plugins ?? []),
      ["expo-notifications", { defaultChannel: "alerts" }],
    ],
  };
}

module.exports = ({ config }) => {
  if (
    process.env.EXPO_PUBLIC_SECURITY_QA === "1" &&
    process.env.EXPO_PUBLIC_DEMO_ONLY !== "1"
  )
    throw new Error("SECURITY_QA requiere el perfil de demo aislado");
  if (process.env.EXPO_PUBLIC_DEMO_ONLY !== "1") return withPush(config);
  return {
    ...config,
    name: "Apisense Demo",
    slug: "apisense-demo",
    scheme: "apisense-demo",
    ios: { ...config.ios, bundleIdentifier: "com.apisense.demo" },
    android: { ...config.android, package: "com.apisense.demo" },
  };
};

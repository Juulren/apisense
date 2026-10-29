module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_DEMO_ONLY !== "1") return config;
  return {
    ...config,
    name: "Apisense Demo",
    slug: "apisense-demo",
    scheme: "apisense-demo",
    ios: { ...config.ios, bundleIdentifier: "com.apisense.demo" },
    android: { ...config.android, package: "com.apisense.demo" },
  };
};

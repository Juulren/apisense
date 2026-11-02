const { withAndroidManifest } = require("expo/config-plugins");

// Main manifest policy. Android's development manifest may permit Metro on
// localhost; the packaged Release application must reject cleartext traffic.
module.exports = (config) =>
  withAndroidManifest(config, (mod) => {
    for (const app of mod.modResults.manifest.application ?? []) {
      app.$["android:allowBackup"] = "false";
      app.$["android:usesCleartextTraffic"] = "false";
    }
    return mod;
  });

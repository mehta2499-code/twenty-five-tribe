import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The phone apps load the live site, so every server deploy reaches the apps
 * straight away. Set APP_URL to change the address; the default is the
 * live site on its https domain.
 */
const url = process.env.APP_URL || "https://the25.world";

const config: CapacitorConfig = {
  appId: "app.twentyfive.social",
  appName: "25",
  // Shown only if the site can't be reached.
  webDir: "mobile/www",
  backgroundColor: "#121019",
  server: {
    url,
    cleartext: url.startsWith("http://"),
    errorPath: "offline.html",
  },
  android: {
    backgroundColor: "#121019",
  },
  ios: {
    backgroundColor: "#121019",
    contentInset: "never",
  },
};

export default config;

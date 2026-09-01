import React from "react";
import { createRoot } from "react-dom/client";

import "./assets/fonts.css";
import { App } from "./App";
import { ConfigProvider } from "./Context";
import { FetchInstanceConfig, GetInstanceConfig } from "./components/etke.cc/InstanceConfig";
import { createI18nProvider } from "./i18n";
import { FetchConfig, GetConfig } from "./utils/config";
import { getSiteBranding } from "./utils/site-branding";

await FetchConfig();
await FetchInstanceConfig(GetConfig().etkeccAdmin, "");
const i18nProvider = await createI18nProvider();

// we set base title here to be used in useDocTitle hook
// as a tricky workaround since hooks can't be used outside components,
// and react-admin doesn't provide a way to set document title directly
const icfg = GetInstanceConfig();
const siteBranding = getSiteBranding(GetConfig().siteBinding);
const baseTitle = siteBranding?.adminName || icfg.name || "Ketesa";
document.head.dataset.baseTitle = baseTitle;
if (!document.title.includes(baseTitle)) {
  document.title = baseTitle;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConfigProvider>
      <App i18nProvider={i18nProvider} />
    </ConfigProvider>
  </React.StrictMode>
);

// Fade out and remove the static loader overlay
const loader = document.getElementById("loader");
if (loader) {
  loader.classList.add("fade-out");
  loader.addEventListener("transitionend", () => loader.remove(), { once: true });
}

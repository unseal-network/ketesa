import { SiteBinding } from "./site-binding";

export interface SiteBranding {
  adminName: string;
  appName: string;
  serverName: string;
  initial: string;
}

export const getSiteBranding = (siteBinding?: SiteBinding): SiteBranding | null => {
  if (!siteBinding) {
    return null;
  }

  let homeserverHost = "";
  try {
    homeserverHost = new URL(siteBinding.homeserverUrl).hostname;
  } catch {
    // FetchConfig validates the binding before rendering. Keep this helper
    // defensive for isolated tests and error states.
  }

  const serverName = siteBinding.serverName?.trim() || homeserverHost;
  const appName = siteBinding.appName?.trim() || serverName;
  const adminName = appName.endsWith("后台") ? appName : `${appName}后台`;
  const initial = Array.from(appName)[0]?.toLocaleUpperCase() || "A";

  return { adminName, appName, serverName, initial };
};

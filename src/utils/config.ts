import createLogger from "./logger";
import { resolveSiteBinding, SiteBinding, SiteBindingError } from "./site-binding";

const log = createLogger("config");

export interface Config {
  restrictBaseUrl: string | string[];
  corsCredentials: string;
  asManagedUsers: RegExp[] | string[];
  menu: MenuItem[];
  externalAuthProvider?: boolean;
  etkeccAdmin?: string;
  wellKnownDiscovery?: boolean;
  siteBinding?: SiteBinding;
}

type DeploymentConfig = Partial<Config>;

export interface MenuItem {
  label: string;
  i18n?: Record<string, string>;
  icon: string;
  url: string;
}

export const WellKnownKey = "cc.etke.ketesa";
export const WellKnownKeyLegacy = "cc.etke.synapse-admin";

type ConfigListener = () => void;

const configListeners = new Set<ConfigListener>();

const notifyConfigListeners = () => {
  configListeners.forEach(listener => listener());
};

// current configuration
let config: Config = {
  restrictBaseUrl: "",
  corsCredentials: "same-origin",
  asManagedUsers: [],
  menu: [],
  etkeccAdmin: "",
};

export const FetchConfig = async () => {
  // load config.json and honor vite base url (import.meta.env.BASE_URL)
  // if that url doesn't have a trailing slash - add it
  let configJSONUrl = "config.json";
  if (import.meta.env.BASE_URL) {
    configJSONUrl = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}config.json`;
  }
  let deploymentConfig: DeploymentConfig | undefined;
  try {
    const resp = await fetch(configJSONUrl);
    deploymentConfig = (await resp.json()) as DeploymentConfig;
    log.debug("config.json loaded", { url: configJSONUrl });
  } catch (e) {
    log.warn("config.json not found, using defaults", e);
  }

  // siteBinding is injected by the trusted reverse proxy for the request Host.
  // Resolve it before well-known so the correct server can supply its optional
  // Ketesa settings, then enforce it again afterwards so well-known cannot
  // unlock or redirect a site-bound admin UI.
  const siteBoundBaseUrl = resolveSiteBinding(deploymentConfig?.siteBinding);
  if (!siteBoundBaseUrl) {
    throw new SiteBindingError("a reverse-proxy-provided siteBinding is required");
  }
  if (deploymentConfig) {
    LoadConfig(deploymentConfig);
  }
  LoadConfig({ restrictBaseUrl: siteBoundBaseUrl });

  await FetchWellKnownConfig(siteBoundBaseUrl);

  LoadConfig({ restrictBaseUrl: siteBoundBaseUrl, siteBinding: deploymentConfig?.siteBinding });

  if (config.externalAuthProvider !== undefined) {
    SetExternalAuthProvider(config.externalAuthProvider);
  }
};

export const FetchWellKnownConfig = async (boundBaseUrl?: string) => {
  let protocol = "https";
  let homeserver: string | null;

  if (boundBaseUrl) {
    const boundURL = new URL(boundBaseUrl);
    protocol = boundURL.protocol.slice(0, -1);
    homeserver = boundURL.host;
  } else {
    const baseURL = localStorage.getItem("base_url");
    if (baseURL && baseURL.startsWith("http://")) {
      protocol = "http";
    }

    // Without a proxy binding, retain the upstream lookup behavior for direct
    // unit-level callers of this helper.
    homeserver = localStorage.getItem("home_server");
  }
  // if it is not set, attempt to identify homeserver from the restrictBaseUrl config
  if (!homeserver) {
    const restrictBaseUrl = config.restrictBaseUrl;
    if (typeof restrictBaseUrl === "string" && restrictBaseUrl !== "") {
      try {
        const url = new URL(restrictBaseUrl);
        const host = url.host;
        if (host) {
          homeserver = host;
        }
      } catch (e) {
        // invalid URL, ignore
        log.warn("invalid restrictBaseUrl, skipping", { restrictBaseUrl, error: e });
      }
    } else if (Array.isArray(restrictBaseUrl) && restrictBaseUrl.length > 0 && restrictBaseUrl[0] !== "") {
      try {
        const url = new URL(restrictBaseUrl[0]);
        const host = url.host;
        if (host) {
          homeserver = host;
        }
      } catch (e) {
        log.warn("invalid restrictBaseUrl, skipping", { restrictBaseUrl: restrictBaseUrl[0], error: e });
      }
    }
  }

  if (!homeserver) {
    return false;
  }

  try {
    const resp = await fetch(`${protocol}://${homeserver}/.well-known/matrix/client`);
    const configWK = await resp.json();
    const wkConfig = configWK[WellKnownKey] || configWK[WellKnownKeyLegacy];
    if (!wkConfig) {
      log.debug("well-known loaded but no Ketesa config key found", {
        homeserver,
        expectedKey: WellKnownKey,
        legacyKey: WellKnownKeyLegacy,
        response: configWK,
      });
      return false;
    }

    log.info("well-known config loaded", { homeserver });
    // Well-known config overlays config.json values (including restrictBaseUrl)
    // intentionally; well-known is admin-trusted as part of the deployment's
    // homeserver config.
    LoadConfig(wkConfig);
    return true;
  } catch (e) {
    log.debug("well-known not found, skipping", { homeserver, error: e });
    return false;
  }
};

// load config from context
// we deliberately processing each key separately to avoid overwriting the whole config, losing some keys, and messing
// with typescript types
export const LoadConfig = (context: Partial<Config>) => {
  const nextConfig: Config = { ...config };
  let changed = false;
  if (context?.restrictBaseUrl) {
    nextConfig.restrictBaseUrl = context.restrictBaseUrl as string | string[];
    changed = true;
  }

  if (context?.corsCredentials) {
    nextConfig.corsCredentials = context.corsCredentials;
    changed = true;
  }

  if (context?.asManagedUsers) {
    nextConfig.asManagedUsers = context.asManagedUsers.map((regex: string | RegExp) =>
      typeof regex === "string" ? new RegExp(regex) : regex
    );
    changed = true;
  }

  let menu: MenuItem[] = [];
  if (context?.menu) {
    menu = context.menu as MenuItem[];
  }
  if (menu.length > 0) {
    nextConfig.menu = menu;
    changed = true;
  }

  if (context?.externalAuthProvider !== undefined) {
    nextConfig.externalAuthProvider = context.externalAuthProvider;
    changed = true;
  }
  // if not set in context, try to load from localStorage
  if (nextConfig.externalAuthProvider === undefined) {
    const storedExternalAuthProvider = localStorage.getItem("external_auth_provider");
    if (storedExternalAuthProvider !== null) {
      nextConfig.externalAuthProvider = storedExternalAuthProvider === "true";
      changed = true;
    }
  }

  if (context?.wellKnownDiscovery !== undefined) {
    nextConfig.wellKnownDiscovery = context.wellKnownDiscovery;
    changed = true;
  }

  if (context?.siteBinding) {
    nextConfig.siteBinding = context.siteBinding;
    changed = true;
  }

  if (context?.etkeccAdmin) {
    nextConfig.etkeccAdmin = context.etkeccAdmin;
    changed = true;
  }

  if (changed) {
    config = nextConfig;
    log.debug("config updated", { config });
    notifyConfigListeners();
  }
};

// get config
export const GetConfig = (): Config => {
  return config;
};

// Clear session-specific runtime state from config and localStorage.
// Static deployment config (restrictBaseUrl, corsCredentials, asManagedUsers, menu, etkeccAdmin)
// is preserved so the login page behaves correctly after logout.
export const ClearConfig = () => {
  config = { ...config, externalAuthProvider: undefined };
  localStorage.clear();
  notifyConfigListeners();
};

// workaround for external auth providers (like OIDC, LDAP, etc.) to signal that some functionality should be disabled
export const SetExternalAuthProvider = (value: boolean) => {
  config = { ...config, externalAuthProvider: value };
  localStorage.setItem("external_auth_provider", value ? "true" : "false");
  notifyConfigListeners();
};

export const SubscribeConfig = (listener: ConfigListener) => {
  configListeners.add(listener);
  return () => {
    configListeners.delete(listener);
  };
};

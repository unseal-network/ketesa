export interface SiteBinding {
  homeserverUrl: string;
  siteId?: string;
}

const siteIdPattern = /^site_[A-Za-z0-9]+$/;
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export class SiteBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteBindingError";
  }
}

/**
 * Validate the reverse-proxy-provided homeserver binding and return its
 * canonical origin. A binding is deliberately stricter than a user-entered
 * URL: it must be a single origin and remote deployments must use HTTPS.
 */
export const resolveSiteBinding = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new SiteBindingError("siteBinding must be an object");
  }

  const binding = value as Partial<SiteBinding>;
  if (binding.siteId !== undefined && (typeof binding.siteId !== "string" || !siteIdPattern.test(binding.siteId))) {
    throw new SiteBindingError("siteBinding.siteId must match site_[A-Za-z0-9]+");
  }
  if (typeof binding.homeserverUrl !== "string" || binding.homeserverUrl.trim() === "") {
    throw new SiteBindingError("siteBinding.homeserverUrl is required");
  }

  let url: URL;
  try {
    url = new URL(binding.homeserverUrl.trim());
  } catch {
    throw new SiteBindingError("siteBinding.homeserverUrl must be a valid URL");
  }

  const isLoopbackHTTP = url.protocol === "http:" && loopbackHosts.has(url.hostname);
  if (url.protocol !== "https:" && !isLoopbackHTTP) {
    throw new SiteBindingError("siteBinding.homeserverUrl must use HTTPS (HTTP is allowed only for loopback)");
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "" && url.pathname !== "/")) {
    throw new SiteBindingError(
      "siteBinding.homeserverUrl must be an origin without credentials, path, query, or fragment"
    );
  }

  return url.origin;
};

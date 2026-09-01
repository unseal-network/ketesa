# Matrix Builder reverse-proxy site binding

This fork accepts a trusted site binding from the reverse proxy that serves the current request. The proxy resolves the HTTP `Host` to a Matrix Builder site and returns a request-specific `/admin/config.json`:

```json
{
  "siteBinding": {
    "siteId": "site_01J8MATRIX",
    "homeserverUrl": "https://matrix.customer.example",
    "serverName": "matrix.customer.example",
    "appName": "Customer Chat"
  }
}
```

The `/admin` build loads that URL before rendering. A valid `siteBinding` becomes the only `restrictBaseUrl`, so Ketesa removes the homeserver input from the login page. The published app name becomes `{appName}后台` throughout the UI, and the footer identifies the site's server name instead of the Ketesa hosting platform. The fork applies the binding again after `/.well-known/matrix/client` is loaded, preventing well-known settings from changing the request's target site or re-enabling the server picker.

The binding is resolved per HTTP request, not at container startup. One generic Ketesa deployment can therefore serve every Matrix site. It needs no control-plane token and no per-site environment variables; only the reverse proxy accesses its existing Host-to-site mapping.

This fork fails closed when the response does not contain a valid `siteBinding`; it never falls back to a user-editable homeserver field. The checked-in `public/config.json` binds local development to `http://localhost:8008`. Production reverse proxies must intercept `/admin/config.json` with the request-specific response above.

The proxy response must be marked `Cache-Control: private, no-store` and `Vary: Host` so a shared cache cannot reuse one site's configuration for another Host. Remote homeserver URLs must use HTTPS and must be origins without credentials, paths, query parameters, or fragments.

Browser JavaScript cannot inspect the DNS CNAME chain. The authoritative mapping is the reverse proxy's resolved site record, specifically its immutable site ID and canonical `public_base_url`.

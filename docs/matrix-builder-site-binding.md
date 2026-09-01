# Matrix Builder site binding

This fork can bind one Ketesa deployment to one Matrix homeserver at container startup. A bound deployment keeps the homeserver field off the login page and re-applies the deployment binding after `/.well-known/matrix/client` is loaded, so well-known settings cannot turn the field back into a free-form input or a server picker.

The container resolves the binding in this order:

1. `MATRIX_HOMESERVER_URL` — an explicit homeserver origin.
2. `MATRIX_HOMESERVER_HOST` — a hostname or customer CNAME; the container adds `https://`.
3. `MATRIX_SITE_ID` — resolved server-side through the Matrix Builder control plane.

For a Matrix Builder site, configure:

```yaml
environment:
  MATRIX_SITE_ID: site_01J8MATRIX
  MATRIX_CONTROL_PLANE_URL: https://control-plane.example.com
  CONTROL_PLANE_API_KEY: ${CONTROL_PLANE_API_KEY}
```

At startup the container requests `GET /v1/matrix-sites/{siteId}`, reads `public_base_url`, and writes only this public binding to `/var/public/config.json`. The control-plane token remains in the container environment and is never written to the static files or sent to the browser.

If the deployment system already knows the public hostname, it can avoid a control-plane request:

```yaml
environment:
  MATRIX_HOMESERVER_HOST: matrix.customer.example
```

For local verification only, loopback HTTP origins are accepted:

```yaml
environment:
  MATRIX_HOMESERVER_URL: http://127.0.0.1:8008
```

The container exits before starting the web server when the binding is missing, unsafe, or cannot be resolved. Remote homeservers must use HTTPS, and the URL must be an origin without credentials, a path, query parameters, or a fragment.

DNS CNAME targets are not visible to browser JavaScript. Pass the customer-facing CNAME through `MATRIX_HOMESERVER_HOST`, or use `MATRIX_SITE_ID` so the control plane supplies the site's canonical `public_base_url`.

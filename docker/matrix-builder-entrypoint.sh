#!/bin/sh

set -eu

fail() {
  printf 'matrix-builder admin configuration error: %s\n' "$1" >&2
  exit 1
}

normalize_homeserver_url() {
  value=${1%/}
  case "$value" in
    https://*) ;;
    http://localhost|http://localhost:*|http://127.0.0.1|http://127.0.0.1:*|http://\[::1\]|http://\[::1\]:*) ;;
    *) fail "homeserver URL must use HTTPS (HTTP is allowed only for loopback)" ;;
  esac

  authority=${value#*://}
  case "$authority" in
    ""|*/*|*'?'*|*'#'*|*@*) fail "homeserver URL must be an origin without credentials, path, query, or fragment" ;;
  esac
  printf '%s' "$authority" \
    | jq -eR 'test("^(\\[[0-9A-Fa-f:]+\\]|[A-Za-z0-9.-]+)(:[0-9]{1,5})?$")' >/dev/null \
    || fail "homeserver URL contains an invalid host or port"
  printf '%s\n' "$value"
}

validate_site_id() {
  printf '%s' "$1" | jq -eR 'test("^site_[A-Za-z0-9]+$")' >/dev/null || fail "MATRIX_SITE_ID is invalid"
}

resolve_from_site_id() {
  site_id=$1
  validate_site_id "$site_id"
  [ -n "${MATRIX_CONTROL_PLANE_URL:-}" ] || fail "MATRIX_CONTROL_PLANE_URL is required with MATRIX_SITE_ID"
  [ -n "${CONTROL_PLANE_API_KEY:-}" ] || fail "CONTROL_PLANE_API_KEY is required with MATRIX_SITE_ID"

  control_plane_url=${MATRIX_CONTROL_PLANE_URL%/}
  response=$(wget -qO- \
    --header="Authorization: Bearer ${CONTROL_PLANE_API_KEY}" \
    "${control_plane_url}/v1/matrix-sites/${site_id}") || fail "could not resolve MATRIX_SITE_ID through the control plane"
  printf '%s' "$response" | jq -er '.public_base_url | select(type == "string" and length > 0)' \
    || fail "control plane site response does not contain public_base_url"
}

site_id=${MATRIX_SITE_ID:-}
[ -z "$site_id" ] || validate_site_id "$site_id"
if [ -n "${MATRIX_HOMESERVER_URL:-}" ]; then
  homeserver_url=$MATRIX_HOMESERVER_URL
elif [ -n "${MATRIX_HOMESERVER_HOST:-}" ]; then
  homeserver_host=${MATRIX_HOMESERVER_HOST%.}
  case "$homeserver_host" in
    ""|*://*|*/*|*'?'*|*'#'*|*@*) fail "MATRIX_HOMESERVER_HOST must be a hostname, not a URL" ;;
  esac
  printf '%s' "$homeserver_host" \
    | jq -eR 'test("^(\\[[0-9A-Fa-f:]+\\]|[A-Za-z0-9.-]+)(:[0-9]{1,5})?$")' >/dev/null \
    || fail "MATRIX_HOMESERVER_HOST is invalid"
  homeserver_url="https://${homeserver_host}"
elif [ -n "$site_id" ]; then
  homeserver_url=$(resolve_from_site_id "$site_id")
else
  fail "set MATRIX_SITE_ID, MATRIX_HOMESERVER_URL, or MATRIX_HOMESERVER_HOST"
fi

homeserver_url=$(normalize_homeserver_url "$homeserver_url")
config_path=${MATRIX_ADMIN_CONFIG_PATH:-/var/public/config.json}
config_directory=${config_path%/*}
[ -d "$config_directory" ] || fail "config directory does not exist: ${config_directory}"

temporary_config="${config_path}.tmp.$$"
trap 'rm -f "$temporary_config"' EXIT HUP INT TERM
jq -n \
  --arg homeserverUrl "$homeserver_url" \
  --arg siteId "$site_id" \
  '{siteBinding: ({homeserverUrl: $homeserverUrl} + (if $siteId == "" then {} else {siteId: $siteId} end))}' \
  >"$temporary_config"
mv "$temporary_config" "$config_path"
trap - EXIT HUP INT TERM

if [ "${MATRIX_ADMIN_CONFIG_ONLY:-}" = "1" ]; then
  exit 0
fi

exec /usr/local/bin/entrypoint.sh "$@"

#!/bin/sh

set -eu

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT HUP INT TERM
config_path="$temporary_directory/config.json"

MATRIX_HOMESERVER_HOST=matrix.example.com \
MATRIX_ADMIN_CONFIG_PATH="$config_path" \
MATRIX_ADMIN_CONFIG_ONLY=1 \
  "$script_directory/matrix-builder-entrypoint.sh"

jq -e '.siteBinding == {homeserverUrl: "https://matrix.example.com"}' "$config_path" >/dev/null

MATRIX_SITE_ID=site_01J8MATRIX \
MATRIX_HOMESERVER_URL=https://tenant.example.com/ \
MATRIX_ADMIN_CONFIG_PATH="$config_path" \
MATRIX_ADMIN_CONFIG_ONLY=1 \
  "$script_directory/matrix-builder-entrypoint.sh"

jq -e '.siteBinding == {homeserverUrl: "https://tenant.example.com", siteId: "site_01J8MATRIX"}' "$config_path" >/dev/null

mkdir "$temporary_directory/bin"
printf '%s\n' '#!/bin/sh' 'printf '\''{"public_base_url":"https://resolved.example.com"}'\''' \
  >"$temporary_directory/bin/wget"
chmod 0755 "$temporary_directory/bin/wget"

PATH="$temporary_directory/bin:$PATH" \
MATRIX_SITE_ID=site_01J8RESOLVED \
MATRIX_CONTROL_PLANE_URL=https://control-plane.example.com \
CONTROL_PLANE_API_KEY=test-only-secret \
MATRIX_ADMIN_CONFIG_PATH="$config_path" \
MATRIX_ADMIN_CONFIG_ONLY=1 \
  "$script_directory/matrix-builder-entrypoint.sh"

jq -e '.siteBinding == {homeserverUrl: "https://resolved.example.com", siteId: "site_01J8RESOLVED"}' "$config_path" >/dev/null

if MATRIX_HOMESERVER_URL=http://tenant.example.com \
  MATRIX_ADMIN_CONFIG_PATH="$config_path" \
  MATRIX_ADMIN_CONFIG_ONLY=1 \
  "$script_directory/matrix-builder-entrypoint.sh" >/dev/null 2>&1; then
  printf 'expected remote HTTP homeserver to be rejected\n' >&2
  exit 1
fi

if MATRIX_SITE_ID=unsafe-site \
  MATRIX_HOMESERVER_URL=https://tenant.example.com \
  MATRIX_ADMIN_CONFIG_PATH="$config_path" \
  MATRIX_ADMIN_CONFIG_ONLY=1 \
  "$script_directory/matrix-builder-entrypoint.sh" >/dev/null 2>&1; then
  printf 'expected an invalid site ID to be rejected\n' >&2
  exit 1
fi

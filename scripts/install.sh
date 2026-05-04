#!/usr/bin/env bash
set -euo pipefail

REPO="zius/Zervox"
# Backward-compatible correction if repo owner is ziuus.
REPO="${ZERVOX_REPO:-ziuus/Zervox}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
BIN="$BIN_DIR/zervox"
VERSION="${VERSION:-latest}"
TARGET="${TARGET:-x86_64-unknown-linux-gnu}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

usage() {
  cat <<USAGE
Zervox installer

Usage:
  install.sh              Install or update Zervox
  install.sh --uninstall  Remove Zervox binary
  install.sh --help       Show help

Environment:
  VERSION=v0.1.0          Install a specific release tag. Default: latest
  BIN_DIR=~/.local/bin    Installation directory
  ZERVOX_REPO=owner/repo  GitHub repo. Default: ziuus/Zervox
USAGE
}

case "${1:-}" in
  --help|-h)
    usage
    exit 0
    ;;
  --uninstall)
    rm -f "$BIN"
    echo "Removed $BIN"
    exit 0
    ;;
  "") ;;
  *)
    echo "error: unknown argument: $1" >&2
    usage >&2
    exit 1
    ;;
esac

mkdir -p "$BIN_DIR"

if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL "$1"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -qO- "$1"; }
else
  echo "error: curl or wget is required" >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: required command not found: $1" >&2
    exit 1
  fi
}

require_cmd tar
require_cmd install

asset="zervox-${TARGET}.tar.gz"

if [[ "$VERSION" == "latest" ]]; then
  api="https://api.github.com/repos/$REPO/releases/latest"
  url="$(fetch "$api" | grep -o "https://[^\"]*$asset" | head -n1 || true)"
else
  url="https://github.com/$REPO/releases/download/$VERSION/$asset"
fi

if [[ -z "${url:-}" ]]; then
  echo "error: could not resolve release asset URL for $asset" >&2
  echo "hint: if no release exists yet, build locally with: cargo install --path ." >&2
  exit 1
fi

echo "Installing Zervox from $url"
fetch "$url" > "$TMP_DIR/$asset"

sha_url="$url.sha256"
if fetch "$sha_url" > "$TMP_DIR/$asset.sha256" 2>/dev/null; then
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$TMP_DIR" && sha256sum -c "$asset.sha256")
  else
    echo "warning: sha256sum not found, skipping checksum verification" >&2
  fi
else
  echo "warning: checksum file not found, skipping verification" >&2
fi

tar -xzf "$TMP_DIR/$asset" -C "$TMP_DIR"
install -m 755 "$TMP_DIR/zervox" "$BIN"

installed_version="$($BIN --version 2>/dev/null || true)"
echo "Installed $installed_version to $BIN"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "warning: $BIN_DIR is not in PATH" >&2 ;;
esac

echo "Run: zervox doctor"

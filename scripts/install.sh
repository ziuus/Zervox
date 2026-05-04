#!/usr/bin/env bash
set -euo pipefail

REPO="ziuus/Zervox"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$BIN_DIR"

if command -v curl >/dev/null 2>&1; then
  FETCH="curl -fsSL"
elif command -v wget >/dev/null 2>&1; then
  FETCH="wget -qO-"
else
  echo "error: curl or wget is required" >&2
  exit 1
fi

VERSION="${VERSION:-latest}"
if [[ "$VERSION" == "latest" ]]; then
  API="https://api.github.com/repos/$REPO/releases/latest"
  URL="$($FETCH "$API" | grep -o 'https://[^\"]*zervox-x86_64-unknown-linux-gnu.tar.gz' | head -n1)"
else
  URL="https://github.com/$REPO/releases/download/$VERSION/zervox-x86_64-unknown-linux-gnu.tar.gz"
fi

if [[ -z "${URL:-}" ]]; then
  echo "error: could not resolve release URL" >&2
  exit 1
fi

echo "Downloading $URL"
$FETCH "$URL" > "$TMP_DIR/zervox.tar.gz"
tar -xzf "$TMP_DIR/zervox.tar.gz" -C "$TMP_DIR"
install -m 755 "$TMP_DIR/zervox" "$BIN_DIR/zervox"

echo "Installed zervox to $BIN_DIR/zervox"
echo "Run: zervox doctor"

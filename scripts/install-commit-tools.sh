#!/bin/bash
# scripts/install-commit-tools.sh
#
# Installs Cocogitto (conventional-commit enforcement) to ~/.local/bin on
# Linux, or via Homebrew on macOS. Mirrors the `setup-tools.sh` convention of
# installing into the user's home — no sudo required.

set -euo pipefail

LOCAL_BIN="${HOME}/.local/bin"
mkdir -p "$LOCAL_BIN"

echo "🪝 Installing commit tools..."

if [[ "${OSTYPE:-}" == "darwin"* ]]; then
    if ! command -v brew >/dev/null 2>&1; then
        echo "❌ Homebrew is required on macOS. Install from https://brew.sh first."
        exit 1
    fi
    brew install cocogitto
elif command -v cargo >/dev/null 2>&1; then
    cargo install cocogitto --root "$HOME/.local"
else
    VERSION=$(curl -fsSL https://api.github.com/repos/cocogitto/cocogitto/releases/latest | grep tag_name | cut -d '"' -f 4)
    if [ -z "$VERSION" ]; then
        echo "❌ Could not resolve latest cocogitto release."
        exit 1
    fi
    TMP=$(mktemp -d)
    trap 'rm -rf "$TMP"' EXIT
    TARBALL="cocogitto-${VERSION}-x86_64-unknown-linux-musl.tar.gz"
    URL="https://github.com/cocogitto/cocogitto/releases/download/${VERSION}/${TARBALL}"
    echo "Downloading $URL"
    curl -fsSL "$URL" -o "$TMP/$TARBALL"
    tar -xzf "$TMP/$TARBALL" -C "$TMP"
    # The release layout has historically varied; find the `cog` binary under $TMP.
    COG_BIN=$(find "$TMP" -type f -name cog | head -1)
    if [ -z "$COG_BIN" ]; then
        echo "❌ Could not locate 'cog' binary in the extracted archive."
        exit 1
    fi
    mv "$COG_BIN" "$LOCAL_BIN/cog"
    chmod +x "$LOCAL_BIN/cog"
fi

echo "✅ Cocogitto installed"
command -v cog >/dev/null 2>&1 && cog --version

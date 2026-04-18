#!/bin/bash
# scripts/setup-tools.sh

set -e

echo "🚀 Setting up development tools..."

# Create local bin directory for user
LOCAL_BIN="$HOME/.local/bin"
mkdir -p "$LOCAL_BIN"

# Add to PATH for the current session
case ":$PATH:" in
    *":$LOCAL_BIN:"*) ;;
    *) export PATH="$LOCAL_BIN:$PATH" ;;
esac

# Append the PATH export to shell rc files only if it's not already written
# there. The previous implementation checked the live PATH, but that does not
# tell us whether the rc file already contains the export — so running this
# script after a shell restart would duplicate the line.
PATH_LINE="export PATH=\"$LOCAL_BIN:\$PATH\""
for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
    if [ -f "$rc" ] && ! grep -Fq "$PATH_LINE" "$rc"; then
        echo "$PATH_LINE" >> "$rc"
    fi
done

# Install Lefthook from GitHub releases
install_lefthook() {
    if command -v lefthook &> /dev/null; then
        echo "✅ Lefthook already installed: $(lefthook version)"
        return
    fi
    
    echo "Installing Lefthook from GitHub releases..."
    
    # Get latest version or use specific version
    VERSION="${LEFTHOOK_VERSION:-$(curl -s https://api.github.com/repos/evilmartians/lefthook/releases/latest | grep tag_name | cut -d '"' -f 4)}"
    VERSION="${VERSION#v}"  # Remove 'v' prefix if present
    
    # Determine platform and architecture
    PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case "$ARCH" in
        x86_64) ARCH="x86_64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    
    # Construct download URL
    # Format: lefthook_${VERSION}_${PLATFORM}_${ARCH}
    FILENAME="lefthook_${VERSION}_${PLATFORM}_${ARCH}"
    URL="https://github.com/evilmartians/lefthook/releases/download/v${VERSION}/${FILENAME}"
    
    echo "Downloading from: $URL"
    
    # Download and install
    if curl -sL "$URL" -o "$LOCAL_BIN/lefthook"; then
        chmod +x "$LOCAL_BIN/lefthook"
        echo "✅ Lefthook ${VERSION} installed successfully"
    else
        echo "❌ Failed to download Lefthook"
        exit 1
    fi
}

# Install Trivy from GitHub releases
install_trivy() {
    if command -v trivy &> /dev/null; then
        echo "✅ Trivy already installed"
        return
    fi
    
    echo "Installing Trivy from GitHub releases..."
    
    VERSION=$(curl -s https://api.github.com/repos/aquasecurity/trivy/releases/latest | grep tag_name | cut -d '"' -f 4)
    VERSION="${VERSION#v}"
    
    PLATFORM=$(uname -s)  # Linux or Darwin
    ARCH=$(uname -m)
    
    case "$ARCH" in
        x86_64) ARCH="64bit" ;;
        aarch64|arm64) ARCH="ARM64" ;;
    esac
    
    # Trivy format: trivy_${VERSION}_${PLATFORM}-${ARCH}.tar.gz
    FILENAME="trivy_${VERSION}_${PLATFORM}-${ARCH}.tar.gz"
    URL="https://github.com/aquasecurity/trivy/releases/download/v${VERSION}/${FILENAME}"
    
    echo "Downloading from: $URL"
    
    curl -sL "$URL" | tar -xz -C "$LOCAL_BIN" trivy
    echo "✅ Trivy ${VERSION} installed successfully"
}

# Install Gitleaks from GitHub releases
install_gitleaks() {
    if command -v gitleaks &> /dev/null; then
        echo "✅ Gitleaks already installed"
        return
    fi
    
    echo "Installing Gitleaks from GitHub releases..."
    
    VERSION=$(curl -s https://api.github.com/repos/gitleaks/gitleaks/releases/latest | grep tag_name | cut -d '"' -f 4)
    VERSION="${VERSION#v}"
    
    PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case "$ARCH" in
        x86_64) ARCH="x64" ;;
        aarch64|arm64) ARCH="arm64" ;;
    esac
    
    # Gitleaks format: gitleaks_${VERSION}_${platform}_${arch}.tar.gz
    FILENAME="gitleaks_${VERSION}_${PLATFORM}_${ARCH}.tar.gz"
    URL="https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/${FILENAME}"
    
    echo "Downloading from: $URL"
    
    curl -sL "$URL" | tar -xz -C /tmp
    mv /tmp/gitleaks "$LOCAL_BIN/"
    rm -f /tmp/LICENSE /tmp/README.md
    echo "✅ Gitleaks ${VERSION} installed successfully"
}

# Run installations
install_lefthook
install_trivy
install_gitleaks

# Install Semgrep via pip (user install)
if ! command -v semgrep &> /dev/null; then
    echo "Installing Semgrep..."
    python3 -m pip install --user semgrep
    echo "✅ Semgrep installed"
fi

echo ""
echo "✅ All tools installed to $LOCAL_BIN"
echo "📝 Please restart your terminal or run: source ~/.bashrc"
echo ""
echo "Installed versions:"
command -v lefthook &> /dev/null && echo "  - Lefthook: $(lefthook version)"
command -v trivy &> /dev/null && echo "  - Trivy: $(trivy --version 2>&1 | head -1)"
command -v gitleaks &> /dev/null && echo "  - Gitleaks: $(gitleaks version)"
command -v semgrep &> /dev/null && echo "  - Semgrep: $(semgrep --version)"
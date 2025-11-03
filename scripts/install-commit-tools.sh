#!/bin/bash
# scripts/install-commit-tools.sh

echo "🪝 Installing commit tools..."

# Detect OS and install Cocogitto
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    brew install cocogitto
elif command -v cargo &> /dev/null; then
    # If Rust is installed
    cargo install cocogitto
else
    # Direct binary download for Linux
    VERSION=$(curl -s https://api.github.com/repos/cocogitto/cocogitto/releases/latest | grep tag_name | cut -d '"' -f 4)
    wget "https://github.com/cocogitto/cocogitto/releases/download/${VERSION}/cocogitto-${VERSION}-x86_64-unknown-linux-musl.tar.gz"
    tar -xzf cocogitto-*.tar.gz
    sudo mv cog /usr/local/bin/
    rm cocogitto-*.tar.gz
fi

echo "✅ Cocogitto installed"
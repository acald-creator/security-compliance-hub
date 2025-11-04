#!/bin/bash
# scripts/setup-repo-security.sh

set -e

REPO_PATH=${1:-.}
SECURITY_HUB_URL="https://github.com/acald-creator/security-compliance-hub"

echo "🔐 Setting up security compliance for repository: $REPO_PATH"

cd "$REPO_PATH"

# Step 1: Create security workflow
echo "📋 Step 1: Adding security workflow..."
mkdir -p .github/workflows

cat > .github/workflows/security.yml << 'EOF'
name: Security Compliance

# Default permissions: grant the workflow the minimal elevated permissions needed
# for signing and uploading provenance when enabled. Callers running this
# workflow will grant these permissions in their repo; remove or restrict
# these if you do not want to allow write operations from the workflow.
permissions:
  id-token: write
  contents: write
  packages: write

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: '0 0 * * 0' # Weekly scan

jobs:
  security:
    uses: acald-creator/security-compliance-hub/.github/workflows/security-scan.yml@main
    with:
      severity-threshold: HIGH
      compliance-frameworks: openssf,owasp,slsa
      enable-signing: true
    secrets: inherit

  devsecops:
    uses: acald-creator/security-compliance-hub/.github/workflows/devsecops-infinity.yml@main
    with:
      phase: all
    secrets: inherit
EOF

# Step 2: Add security files
echo "📄 Step 2: Adding security templates..."
curl -sL "$SECURITY_HUB_URL/raw/main/templates/SECURITY.md" > SECURITY.md
curl -sL "$SECURITY_HUB_URL/raw/main/templates/SECURITY-INSIGHTS.yml" > SECURITY-INSIGHTS.yml

# Step 3: Setup git hooks
echo "🪝 Step 3: Setting up git hooks..."
curl -sL "$SECURITY_HUB_URL/raw/main/hooks/lefthook.yml" > lefthook.yml
lefthook install

# Step 4: Configure security tools
echo "🛠️ Step 4: Configuring security tools..."
curl -sL "$SECURITY_HUB_URL/raw/main/config/.gitleaks.toml" > .gitleaks.toml
curl -sL "$SECURITY_HUB_URL/raw/main/config/cog.toml" > cog.toml
curl -sL "$SECURITY_HUB_URL/raw/main/config/biome.json" > biome.json

# Step 5: Create Dependabot config
echo "🤖 Step 5: Setting up Dependabot..."
mkdir -p .github
cat > .github/dependabot.yml << 'EOF'
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "dependencies"
      - "security"
    open-pull-requests-limit: 10
EOF

# Step 6: Enable GitHub security features
echo "🛡️ Step 6: Configuring GitHub security features..."
gh api -X PUT /repos/$GITHUB_REPOSITORY/vulnerability-alerts || true
gh api -X PUT /repos/$GITHUB_REPOSITORY/automated-security-fixes || true

echo "✅ Security compliance setup complete!"
echo ""
echo "Next steps:"
echo "1. Review and customize SECURITY.md"
echo "2. Create threat model in docs/THREAT_MODEL.md"
echo "3. Run 'gh workflow run security.yml' to trigger first scan"
echo "4. Check security score at: https://github.com/$GITHUB_REPOSITORY/security"
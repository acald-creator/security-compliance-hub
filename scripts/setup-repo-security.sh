#!/bin/bash
# scripts/setup-repo-security.sh

set -e

REPO_PATH=${1:-.}
SECURITY_HUB_URL="https://github.com/acald-creator/security-compliance-hub"

echo "🔐 Setting up security compliance for repository: $REPO_PATH"

cd "$REPO_PATH"

# Helper: download a file from the hub raw URL; if the response is HTML or 404,
# write a safe fallback and warn the user. This avoids writing GitHub HTML error
# pages into configuration files when the remote path doesn't exist or network
# access is restricted.
fetch_file() {
  local remote_path="$1"
  local dest="$2"
  local url="$SECURITY_HUB_URL/raw/main/$remote_path"

  echo "Fetching $url -> $dest"
  # Try to retrieve headers and body
  http_status=$(curl -s -o /tmp/setup_repo_fetch_body --write-out "%{http_code}" -L "$url" || true)

  # Detect failure or HTML responses
  if [ "$http_status" != "200" ]; then
    echo "⚠️  Warning: could not fetch $url (HTTP $http_status). Creating placeholder $dest"
    cat > "$dest" <<'EOF'
<!-- Placeholder file: original resource not available. Please replace with your desired content. -->
EOF
    return
  fi

  # Check if the body looks like HTML (GitHub 404/HTML pages)
  if grep -qi "<!doctype html>\|<html" /tmp/setup_repo_fetch_body 2>/dev/null; then
    echo "⚠️  Warning: fetched content for $url looks like HTML (likely a 404 or redirect). Creating placeholder $dest"
    cat > "$dest" <<'EOF'
<!-- Placeholder file: fetched content was HTML (resource missing). Please replace with the intended file. -->
EOF
    rm -f /tmp/setup_repo_fetch_body
    return
  fi

  # Otherwise move the body into place
  mv /tmp/setup_repo_fetch_body "$dest"
}

# Step 1: Create security workflow (or templates when running inside the hub repo)
echo "📋 Step 1: Adding security workflow..."

# Detect if the target path is actually this repository (the hub). In that
# case we don't want to overwrite the repo's top-level workflows; instead we
# write recommended template artifacts into an examples/templates directory so
# users can copy them into their repos. Also support an explicit
# TEMPLATES_ONLY=1 env var to force template generation.
repo_origin=$(git -C "$REPO_PATH" config --get remote.origin.url 2>/dev/null || true)
hub_identifier="acald-creator/security-compliance-hub"
if [ "${TEMPLATES_ONLY:-0}" = "1" ] || echo "$repo_origin" | grep -qi "$hub_identifier"; then
  echo "Detected hub repository or TEMPLATES_ONLY=1 — generating templates under 'examples/target-repo-template'"
  TEMPLATE_DIR="$REPO_PATH/examples/target-repo-template"
  mkdir -p "$TEMPLATE_DIR/.github/workflows" "$TEMPLATE_DIR/config"

  cat > "$TEMPLATE_DIR/.github/workflows/security.yml" << 'EOF'
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

  # Also create empty placeholders for the other artifacts in the template dir
  fetch_file "templates/SECURITY.md" "$TEMPLATE_DIR/SECURITY.md"
  fetch_file "templates/SECURITY-INSIGHTS.yml" "$TEMPLATE_DIR/SECURITY-INSIGHTS.yml"
  fetch_file "hooks/lefthook.yml" "$TEMPLATE_DIR/lefthook.yml"
  fetch_file "config/.gitleaks.toml" "$TEMPLATE_DIR/config/.gitleaks.toml"
  fetch_file "config/cog.toml" "$TEMPLATE_DIR/config/cog.toml"
  # Do NOT include a root biome.json in the templates: Biome expects a
  # repository-level config file; adding one here would make target repos
  # pick it up unintentionally. If you need a sample Biome config, place it
  # under examples or document it separately.

  echo "Templates written to: $TEMPLATE_DIR"
  # We've generated template artifacts for distribution; do not continue
  # writing files into the hub repository root to avoid overwriting
  # or conflicting with this repo's own workflows.
  exit 0
else
  mkdir -p "$REPO_PATH/.github/workflows"

  cat > "$REPO_PATH/.github/workflows/security.yml" << 'EOF'
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
fi

# Step 2: Add security files
echo "📄 Step 2: Adding security templates..."
fetch_file "templates/SECURITY.md" SECURITY.md
fetch_file "templates/SECURITY-INSIGHTS.yml" SECURITY-INSIGHTS.yml

# Step 3: Setup git hooks
echo "🪝 Step 3: Setting up git hooks..."
fetch_file "hooks/lefthook.yml" lefthook.yml
# Install lefthook if available, otherwise warn
if command -v lefthook >/dev/null 2>&1; then
  lefthook install || true
else
  echo "⚠️  lefthook not installed; skipping lefthook install."
fi

# Step 4: Configure security tools
echo "🛠️ Step 4: Configuring security tools..."
fetch_file "config/.gitleaks.toml" .gitleaks.toml
fetch_file "config/cog.toml" cog.toml
# Do NOT place a root `biome.json` into the target repository automatically:
# Biome will treat a repository-level biome.json as the authoritative
# configuration. Creating one here could unintentionally change behavior for
# the target repo. If you want to include a sample biome config, add it to
# the examples directory and copy it into the target repo manually.

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
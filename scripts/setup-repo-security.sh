#!/bin/bash
# scripts/setup-repo-security.sh

set -e

REPO_PATH=${1:-.}
SECURITY_HUB_URL="https://github.com/acald-creator/security-compliance-hub"

echo "🔐 Setting up security compliance for repository: $REPO_PATH"

cd "$REPO_PATH"

# Helper: download a file from the hub raw URL; if the response is HTML or 404,
# warn the user and skip the file. This avoids writing GitHub HTML error pages
# or unrelated content into configuration files when the remote path doesn't
# exist or network access is restricted.
#
# Safety guards:
#   1. Existing files are never overwritten unless FORCE_OVERWRITE=1 is set.
#   2. HTML responses (GitHub 404/redirect pages) are rejected.
#   3. Content is validated against the destination file extension — a .toml
#      destination that receives Markdown (or vice versa) is rejected.
#   4. A process-specific temp file avoids collisions with parallel runs.
fetch_file() {
  local remote_path="$1"
  local dest="$2"
  local url="$SECURITY_HUB_URL/raw/main/$remote_path"
  local tmpfile="/tmp/setup_repo_fetch_body.$$"

  # Guard: do not overwrite existing files unless explicitly requested
  if [ -f "$dest" ] && [ "${FORCE_OVERWRITE:-0}" != "1" ]; then
    echo "ℹ️  Skipping $dest (already exists). Set FORCE_OVERWRITE=1 to replace."
    return
  fi

  echo "Fetching $url -> $dest"
  http_status=$(curl -s -o "$tmpfile" --write-out "%{http_code}" -L "$url" || true)

  # Detect failure
  if [ "$http_status" != "200" ]; then
    echo "⚠️  Warning: could not fetch $url (HTTP $http_status). Skipping $dest."
    rm -f "$tmpfile"
    return
  fi

  # Reject HTML responses (GitHub 404/redirect pages)
  if grep -qi "<!doctype html>\|<html" "$tmpfile" 2>/dev/null; then
    echo "⚠️  Warning: fetched content for $url looks like HTML (likely a 404 or redirect). Skipping $dest."
    rm -f "$tmpfile"
    return
  fi

  # Validate that the content looks appropriate for the destination file type.
  # This prevents, e.g., a Markdown README from being written into a .toml file.
  local ext="${dest##*.}"
  case "$ext" in
    toml)
      if grep -qi "^#\|^\[" "$tmpfile" 2>/dev/null; then
        : # looks like TOML or INI — acceptable
      else
        echo "⚠️  Warning: fetched content for $dest does not look like TOML. Skipping."
        rm -f "$tmpfile"
        return
      fi
      ;;
    yml|yaml)
      if grep -qi "^[a-z_-]*:" "$tmpfile" 2>/dev/null; then
        : # looks like YAML — acceptable
      else
        echo "⚠️  Warning: fetched content for $dest does not look like YAML. Skipping."
        rm -f "$tmpfile"
        return
      fi
      ;;
    md)
      # Markdown is freeform; just ensure it isn't binary
      if file "$tmpfile" 2>/dev/null | grep -qi "text"; then
        : # text content — acceptable
      else
        echo "⚠️  Warning: fetched content for $dest does not look like text. Skipping."
        rm -f "$tmpfile"
        return
      fi
      ;;
  esac

  mv "$tmpfile" "$dest"
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
    uses: acald-creator/security-compliance-hub/.github/workflows/security-scan.yml@v0
    with:
      severity-threshold: HIGH
      compliance-frameworks: openssf,owasp,slsa
      enable-signing: true
    secrets: inherit

  devsecops:
    uses: acald-creator/security-compliance-hub/.github/workflows/devsecops-infinity.yml@v0
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
    uses: acald-creator/security-compliance-hub/.github/workflows/security-scan.yml@v0
    with:
      severity-threshold: HIGH
      compliance-frameworks: openssf,owasp,slsa
      enable-signing: true
    secrets: inherit

  devsecops:
    uses: acald-creator/security-compliance-hub/.github/workflows/devsecops-infinity.yml@v0
    with:
      phase: all
    secrets: inherit
EOF
fi

# Step 2: Add security files
echo "📄 Step 2: Adding security templates..."
fetch_file "templates/SECURITY.md" SECURITY.md
fetch_file "templates/SECURITY-INSIGHTS.yml" SECURITY-INSIGHTS.yml
# The devsecops-infinity plan-phase expects docs/THREAT_MODEL.md. Drop the
# starter template in place so the first workflow run has something to check.
mkdir -p docs
fetch_file "templates/THREAT_MODEL.md" docs/THREAT_MODEL.md

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
#
# Resolve the GitHub owner/repo slug. Inside GitHub Actions this is exported
# as $GITHUB_REPOSITORY; locally we parse it from the `origin` git remote so
# the gh api calls actually hit a real endpoint instead of /repos//… (404).
echo "🛡️ Step 6: Configuring GitHub security features..."

resolve_repo_slug() {
    if [ -n "${GITHUB_REPOSITORY:-}" ]; then
        echo "$GITHUB_REPOSITORY"
        return
    fi
    local origin
    origin=$(git -C "$REPO_PATH" config --get remote.origin.url 2>/dev/null || true)
    if [ -z "$origin" ]; then
        return
    fi
    # Strip known prefixes/suffixes: git@github.com:owner/repo.git, https://github.com/owner/repo(.git)
    origin="${origin#git@github.com:}"
    origin="${origin#https://github.com/}"
    origin="${origin#http://github.com/}"
    origin="${origin%.git}"
    echo "$origin"
}

REPO_SLUG=$(resolve_repo_slug)
if [ -z "$REPO_SLUG" ]; then
    echo "⚠️  Could not determine GitHub repo slug; skipping vulnerability-alert enablement."
    echo "    Set GITHUB_REPOSITORY=owner/name or add a GitHub 'origin' remote and re-run."
elif ! command -v gh >/dev/null 2>&1; then
    echo "⚠️  'gh' CLI not found; skipping vulnerability-alert enablement for $REPO_SLUG."
else
    gh api -X PUT "/repos/$REPO_SLUG/vulnerability-alerts" || true
    gh api -X PUT "/repos/$REPO_SLUG/automated-security-fixes" || true
fi

echo "✅ Security compliance setup complete!"
echo ""
echo "Next steps:"
echo "1. Review and customize SECURITY.md"
echo "2. Create threat model in docs/THREAT_MODEL.md"
echo "3. Run 'gh workflow run security.yml' to trigger first scan"
if [ -n "$REPO_SLUG" ]; then
    echo "4. Check security score at: https://github.com/$REPO_SLUG/security"
fi
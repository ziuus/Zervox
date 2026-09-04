#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# Zervox DevSecOps: Credential Purge Utility
# Completely scrubs sensitive tokens from the Git commit tree
# and reflogs, preventing credential exposure.
# ==========================================================

TARGET_TOKEN="${1:-[REDACTED_GITHUB_TOKEN]}"
REPLACEMENT="[REDACTED_GITHUB_PAT]"

echo "🔒 [SECURITY] Starting credential scrubbing for token: ${TARGET_TOKEN:0:8}..."

# 1. Check if git-filter-repo is installed
if command -v git-filter-repo &> /dev/null; then
    echo "→ Utilizing git-filter-repo for history rewrite..."
    TMP_EXPR=$(mktemp)
    echo "${TARGET_TOKEN}==>${REPLACEMENT}" > "${TMP_EXPR}"
    git-filter-repo --replace-text "${TMP_EXPR}" --force
    rm -f "${TMP_EXPR}"
else
    echo "→ git-filter-repo not found; executing python/git-filter-branch / reflog sanitization..."
    # Expunge any dangling references and reflogs containing the token
    rm -rf .git/logs/
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
fi

echo "✔ Verification: Checking if token string remains in Git object database..."
MATCHES=$(git log --all -S "${TARGET_TOKEN}" --oneline 2>/dev/null || true)
if [ -z "${MATCHES}" ]; then
    echo "✔ Clean! No commits contain the target credential."
else
    echo "⚠️ Commit tree contains references:"
    echo "${MATCHES}"
fi

echo "✔ Credential purge procedure completed."

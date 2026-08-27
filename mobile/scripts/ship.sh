#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Verify every local (file:) dependency's target directory actually exists.
# A stale file: entry left pointing at a deleted directory (e.g. a native
# module removed without also removing its package.json line) installs
# fine locally with existing node_modules state, but EAS's
# `bun install --frozen-lockfile` step hard-fails trying to resolve it —
# wasting a build credit on a failure that's obvious from the repo alone.
# Check here, before spending one.
node -e "
  const pkg = require('./package.json');
  const fs = require('fs');
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const missing = Object.entries(deps)
    .filter(([, spec]) => spec.startsWith('file:'))
    .filter(([, spec]) => !fs.existsSync(spec.slice(5)));
  if (missing.length) {
    for (const [name, spec] of missing) {
      console.error(\`Local dependency '\${name}' points to missing directory '\${spec.slice(5)}' — fix package.json before shipping.\`);
    }
    process.exit(1);
  }
"

echo "Building for App Store..."
eas build --platform ios --profile production --non-interactive

echo "Submitting to App Store Connect..."
eas submit --platform ios --profile production --latest --non-interactive

echo "Done."

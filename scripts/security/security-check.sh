#!/usr/bin/env bash
set -e

echo "=== NODE SYNTAX ==="
node --check server.js
node --check routes/cases.js
node --check routes/auth.js
node --check middleware/inputSecurity.js

echo
echo "=== PACKAGE AUDIT ==="
npm audit --audit-level=high

echo
echo "=== GIT DIFF ==="
git diff --check

echo
echo "=== API AUTH AUDIT ==="
node scripts/security/audit-api.js

echo
echo "=== STATUS ==="
git status --short

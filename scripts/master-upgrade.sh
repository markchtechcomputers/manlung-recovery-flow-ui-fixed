#!/usr/bin/env bash
set -euo pipefail

PROJECT="$HOME/Downloads/manlungrecovery-main-updated-safe"
cd "$PROJECT"

echo "=========================================="
echo " MANLUNG RECOVERY MASTER FEATURE UPGRADE"
echo "=========================================="

echo "[1] Sync"
git pull --rebase origin main

echo "[2] Verify clean tree"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree is not clean."
  git status
  exit 1
fi

echo "[3] Create rollback branch"
BACKUP_BRANCH="upgrade-backup-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH"
echo "Rollback branch: $BACKUP_BRANCH"

echo "[4] Dependencies"
npm install

echo "[5] Baseline validation"
node --check server.js
node --check routes/auth.js
node --check routes/cases.js
node --check routes/calls.js
node --check routes/messages.js
node --check routes/notifications.js
node --check models/User.js
node --check models/Case.js
node --check models/CaseMessage.js
node --check models/Notification.js
node --check models/CaseTimeline.js
git diff --check

echo "[6] Feature modules"
echo "  - Active call cleanup"
echo "  - Admin assignment/reassignment"
echo "  - Notification bell"
echo "  - Message unread badges"
echo "  - Evidence management"
echo "  - Admin analytics"
echo "  - Support center"
echo "  - Automated emails"
echo "  - PWA/mobile"
echo "  - Security hardening"

# Feature modules will be inserted here.
# Each module must:
#   1. make only targeted changes
#   2. validate its changed files
#   3. stop immediately on failure

echo "[7] Final validation"
git diff --check

echo "[8] Review"
git diff --stat
git status

echo ""
echo "=========================================="
echo " UPGRADE PREPARED"
echo "=========================================="
echo "Rollback: $BACKUP_BRANCH"
echo ""
echo "No automatic commit/push until all modules pass."

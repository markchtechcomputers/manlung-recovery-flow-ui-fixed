# Manlung Recovery Full Repair — 2026-09-15

The outer `manlung-recovery-flow-ui-fixed-main` tree is the master application. The nested `manlungrecovery-main` tree is retained as a backup/reference and is not used as the deployment root.

Changes in this repair:
- Activated the existing CSRF browser bootstrap on master pages; state-changing admin cookie requests now send the CSRF header.
- Kept CSRF enforcement enabled; no bypass was added.
- Admin and Owner sessions are now issued with 24-hour JWT/cookie lifetime; clients are issued 7-day sessions.
- Expired privileged sessions clear their admin cookie server-side.
- Client frontend no longer forces a 30-minute inactivity logout; the session follows the 7-day absolute lifetime.
- Client registration uses a unique display username and requires 8+ character passwords.
- Consolidated all master-page footers into one compact shared footer with Careers and Donate links.
- Added a unified UI layer to remove decorative header icons while preserving functional mobile menu controls.
- Normalized local logo paths.
- Fixed known duplicate report IDs.
- Admin beforeunload presence now uses keepalive fetch so CSRF headers can be included.
- Existing call/WebRTC files and call settings were not migrated or replaced.

The nested backup remains in the ZIP intentionally. Deploy only from the outer project root.

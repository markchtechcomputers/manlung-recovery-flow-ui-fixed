# Manlung Recovery — Comprehensive Feature Completion Plan

This document is the working checklist for the full product pass. Existing working functionality must be preserved while missing/partial functionality is completed.

## Already implemented / preserve
- Per-account persistent login lockout: 3 failed passwords -> 132-year lockout.
- Owner/admin MFA and protected authentication flow.
- Client registration/login/settings/dashboard.
- Owner invitation -> admin registration -> owner approval.
- Admin suspend/reactivate/remove and permission management.
- Case ownership and admin capacity controls.
- Case timeline and client-visible feedback.
- Case messaging and notifications.
- WebRTC Call Admin with ringing, first-answer-wins, accept/decline, mute, duration and cleanup.
- Paystack donation confirmation/webhook flow.
- Operations analytics and reporting.
- Careers workflow.
- Website safety scanner.
- PWA/manifest and responsive UI.
- Security headers, CORS, input validation and upload validation.

## Completed in this pass
- Owner Control Center at `/admin/control-center.html`.
- Live operational metrics, team workload, case-status visualization and 14-day trend view.
- Owner audit activity view inside Control Center.
- Admin directory search.
- Safe account-security monitor showing MFA state, failed-login count, lockout state and last-login time without exposing passwords, hashes, MFA secrets or recovery codes.
- Client Recovery Center at `/client/recovery-center.html`.
- Unified client case list, notification center, unread counters, case conversation and message sending using the existing authenticated APIs.

## Next implementation targets
1. **Case engine:** priority/SLA, explicit lifecycle transitions, transfer/reassignment, reopen/close, internal notes, client-visible notes, attachment history and complete audit events.
2. **Security center:** durable session/revocation storage, security-event history, suspicious-login detection, owner security alerts and regression tests.
3. **Evidence:** SHA-256 hashes, evidence categories/metadata, preview/download audit trail and optional malware scanning integration without weakening upload restrictions.
4. **Communication:** richer notification types, missed-call notifications, message read receipts, case communication history and human-support handoff.
5. **Client experience:** case report export, timeline export, feedback/satisfaction flow, clearer case status explanations and recovery guidance.
6. **Admin experience:** workload queue, advanced case search/filtering, SLA indicators, bulk-safe actions, availability state and performance history.
7. **Calling:** missed-call history, reconnect handling, network quality indicators and TURN health diagnostics.
8. **Donations:** donor history/receipts, pending/failed state visibility, reference lookup and owner analytics.
9. **AI:** strict authenticated case lookup, context retention, safe tool boundaries, prompt-injection resistance, human escalation and live site-policy retrieval.
10. **Public website:** services/how-it-works/FAQ/trust pages, clearer recovery guidance, SEO metadata and conversion improvements.
11. **Production:** dependency audit/scanning, secret scanning, database backup verification, health checks and end-to-end tests against a staging Supabase/WebRTC environment.

## Non-negotiable safety constraints
- Never modify owner credentials, password/hash values, MFA credentials or recovery secrets.
- Never expose client private data to another client/admin without server-side authorization.
- Never expose passwords, password hashes, MFA secrets, OTPs, recovery codes or API secrets in UI, logs or APIs.
- Keep account lockout isolated per user account.
- Keep owner-only controls server-enforced, not merely hidden in the UI.

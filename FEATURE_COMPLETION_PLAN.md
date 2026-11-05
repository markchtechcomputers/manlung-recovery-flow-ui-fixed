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


## Implementation status — 2026-11-05

### Committed on `fix/oauth-clean-routes-20261105`
- Friend-request send path now validates independent database checks in parallel; sent/received requests are visible, sent requests can be cancelled, and acceptance opens chat only after server confirmation.
- Desktop/mobile chat close control, status poster-name fallback and the `/privacy` clean route are implemented.
- Turnstile SDK loading remains lazy, with configured-only preconnect and reusable server-side TLS connections.
- OTP browser notifications can open the inbox; clipboard paste/copy support remains available.
- Peer calls now have bounded ICE-restart recovery with a watchdog, plus live RTT/network-quality and TURN-relay diagnostics.
- Evidence uploads store SHA-256 integrity metadata; upload and owner-delete actions write to the evidence audit table when migrations are present.
- Case creation records configurable internal SLA due times; owner reassignment validates an active administrator; owners can reopen finished cases.
- Client Recovery Center supports privacy-safe case CSV export and post-completion satisfaction feedback.
- Donations now have authenticated donor history, confirmed receipt data/print page, and owner visibility of pending/confirmed/failed records with all-row aggregates.
- Recovery Center notification rendering and sender identity handling were corrected.

### Still requiring external setup or verification
- Supabase migrations `015_platform_completion.sql`, `016_operations_completion.sql`, `034_status_plan_priority.sql` and `035_case_feedback.sql` must be applied/verified in order. The connected Supabase tool returned a permission-denied response, so this pass did not change or verify the live database.
- The Vercel Preview deployment for the current branch/commit is blocked by the team's daily deployment quota (HTTP 402, `api-deployments-free-per-day`). A scheduled Preview-only retry is set for 2026-11-06 09:00 Africa/Nairobi and targets the latest commit. Production remains untouched.
- Real-device/end-to-end verification is still required for camera capture/upload, two-account friend/chat flows, OTP delivery and browser notifications, Paystack receipts, and voice/video calls across mobile networks.
- Malware scanning is not configured; evidence metadata explicitly reports `not_configured`. SHA-256 is an integrity hash, not a malware scan.
- Missed-call notification/history delivery, evidence preview/download audit events, broader admin availability/performance history, AI human escalation/prompt-injection evaluation, public SEO/conversion review, and production backup/dependency/secret-scan checks remain to be completed or independently verified.

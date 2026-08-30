# Call Admin — Free calling update (2026-08-25)

This update keeps the existing application structure, database tables, WebRTC signaling, Admin presence, case workflow, and call-session records in place. No database migration is required.

## Changes

- Removed the Call Admin subscription requirement from the client call flow.
- Call Admin is now available to authenticated clients without payment.
- Removed the subscription/payment UI from the Call Admin widget; donation payments are untouched.
- Kept existing subscription/entitlement tables and legacy payment code in place for compatibility with existing data.
- Admins can continue accepting incoming client calls.
- Admins can call a client back directly from the client's case using **Call Client**.
- Client callback acceptance/rejection continues through the existing authenticated callback flow.
- Added five selectable call ringtones for clients and Admins:
  - Soft Bell
  - Gentle Chime
  - Sweet Pulse
  - Calm Tone
  - Bright Call
- Added a **Test** button for ringtone selection.
- Client and Admin ringtone choices are stored separately in browser local storage.
- Improved ringtone playback by resuming the browser AudioContext when possible.
- Updated Terms to state that Call Admin voice support is currently free.

## Database / migration safety

No existing migration was changed or removed. Existing call and subscription records are left intact. The subscription columns remain available for backward compatibility, but they no longer control Call Admin access.

# Manlung Recovery — Website Safety Scanner Upgrade

## What was changed

This update improves the existing Website Safety Scanner without changing the existing WebRTC call system, Supabase authentication, client portal, or admin call workflow.

### 1. Verified official website directory

The scanner now uses `config/official-websites.js` as a small, explicit trust directory. It currently contains:

- Manlung Recovery: `manlungrecovery.manlungshop.co.ke`
- Kenya Revenue Authority: `kra.go.ke`
- eCitizen Kenya: `ecitizen.go.ke`

Subdomains of a verified root domain are treated as official. This means `itax.kra.go.ke` can be recognized as an official KRA subdomain instead of being labelled merely “unknown”.

**Important:** this is not an automatic claim that every website on the internet is legitimate. New organisations should only be added after their official domain is independently verified from a trustworthy first-party source.

### 2. Impersonation / clone detection

The scanner now checks an unverified hostname for stronger signs that it is imitating a verified organisation, including:

- brand terms in the hostname
- brand references in the page title
- official-brand phrases in page content
- close hostname/typo similarity to a verified root label

When strong evidence is present, the result can be:

> Likely Impersonation / Clone

The scanner does **not** label every unknown domain a scam. Unknown domains remain unverified unless there is stronger evidence.

### 3. Official identity is separated from technical warnings

A verified official domain can still have technical findings such as missing security headers. Those findings are shown separately. A missing header does not cause a verified official domain to be falsely labelled as a fake website.

### 4. Homepage scanner shortcut

A compact **Website Safety Scanner** card was added immediately below **Track Your Case** on the homepage. It links to `/link-scanner.html` and uses a shield icon.

### 5. Footer redesign

The homepage and scanner page now use a thin footer line. YouTube is represented by a small icon on the bottom-right rather than a large footer section.

## What was intentionally not changed

- Existing WebRTC call files
- Existing WebRTC signaling
- Existing TURN/STUN configuration
- Existing Supabase authentication
- Existing client dashboard
- Existing admin dashboard call workflow
- Existing call session mechanism

## Verification

The following JavaScript syntax checks were run successfully:

- `node --check server.js`
- `node --check public/js/link-scanner.js`

A full application test run requires the project's normal installed dependencies and production environment variables; those are intentionally not bundled into this ZIP.

## Important scanner limitation

A technical scanner cannot prove that an arbitrary unknown website is legitimate or fraudulent. The safest classification model is:

- **Verified Official Website** — domain is in the trusted directory / verified source.
- **Likely Impersonation / Clone** — strong evidence of imitation of a known verified organisation.
- **Use Caution / Unverified** — technical warnings or insufficient ownership evidence.
- **No Major Technical Problems Detected** — technical checks were clean, but ownership is still not proven.

The trusted directory should be expanded over time using verified first-party sources.

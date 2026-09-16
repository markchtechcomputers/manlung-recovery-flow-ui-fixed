# Manlung Recovery update notes

This build adds the requested UI and owner features while preserving the existing Call Admin/WebRTC flow.

## Supabase migration required
Run the new migration in `db/migrations/009_careers_and_donation_names.sql` before deploying:

- Creates `career_applications`.
- Adds `donor_name` to `recovery_donations`.

## New public page
- `/careers.html` — career application form.

## Owner portal
- Career applications can be reviewed, shortlisted, marked hired/rejected, individually deleted, or cleared.
- Audit Log now has an Owner-only clear button.

## Donation
- Donor name is captured and returned after Paystack verification.
- A named thank-you message is shown after a confirmed donation.
- Admin donation table includes donor name.

## Calls
- Existing call/WebRTC/TURN implementation was preserved.
- Client callback UI shows the assigned Admin's name when available.

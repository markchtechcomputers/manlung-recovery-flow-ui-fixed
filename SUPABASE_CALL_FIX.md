# Call Admin database fix

The client screenshot showed:

`Connection failed: Could not find the table 'public.recovery_call_signals' in the schema cache.`

That is a **Supabase database/schema-cache issue**, not a microphone permission issue and not a Paystack-key issue.

## Do this once in Supabase

Open **Supabase → SQL Editor**, paste the contents of:

`db/migrations/006_fix_call_signals_schema.sql`

and click **Run**.

The SQL is idempotent, so it is safe to run even if the table already exists. It also tells PostgREST to reload its schema cache.

After running it:

1. Deploy the current project to Vercel.
2. Log in as Admin.
3. Set Admin status to **Online**.
4. From the client portal, press **Call Admin**.
5. Accept the call on the Admin portal.
6. Allow microphone access on both devices.

## If the error still says schema cache

Run this line by itself in Supabase SQL Editor:

```sql
NOTIFY pgrst, 'reload schema';
```

Then wait a few seconds and retry the call.

## Paystack

The code in this ZIP already uses the server-side Paystack initialization flow. Keep these Vercel **Production** variables configured:

- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_SECRET_KEY`
- `PUBLIC_APP_URL`
- `PAYSTACK_CALLBACK_URL` (recommended)

Do not put `PAYSTACK_SECRET_KEY` in browser JavaScript.

## WebRTC

For mobile/restricted networks, also keep these Vercel **Production** variables configured:

- `TURN_URL`
- `TURN_USERNAME`
- `TURN_CREDENTIAL`

The browser receives only temporary TURN connection information from the authenticated API; the Supabase service-role key and Paystack secret remain server-side.

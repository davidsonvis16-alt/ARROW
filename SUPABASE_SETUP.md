# ARROW — Supabase setup

ARROW keeps its entire authorization model in the database. Getting this file
right is not optional polish: the client has no ability to enforce who may see
whom, and is not trusted to try.

---

## 1. Run the schema

1. Open your Supabase project, go to **SQL Editor**, and click **New query**.
2. Paste the whole of `supabase/schema.sql` and run it.
3. The last statement prints a summary and raises if anything did not land:

   ```
   NOTICE: ARROW schema installed: 13 tables, 56 functions, RLS active on all.
   ```

   If you see an error instead, nothing was half-applied — fix the cause and run
   it again. The script is idempotent, so re-running it is always safe and is
   also how you upgrade an existing install.

**Upgrading an existing install.** The script adapts to data written by earlier
versions rather than demanding a clean database. Two notices are normal and not
errors:

- `removed outdated function ...` — an older version of a function whose
  arguments have since changed. Left in place it would stay callable and
  compete with the current one.
- `check_... not validated` — a row predates a new length limit, so the rule
  applies to every future write but the old row is left exactly as its owner
  wrote it. Nothing is truncated.

Photos written by older clients all share `display_order = 0`, because the old
upload path defaulted it. They are renumbered per user, keeping their existing
order. No photo is deleted and none is reordered relative to the others.

**Coexistence.** Every object is prefixed `arrow_` and photos live in a
dedicated `arrow-profile-photos` bucket, so a project that already holds
unrelated tables is untouched.

---

## 2. Configure the app

Copy the project URL and the **anon/publishable** key from
**Project Settings → API** into `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

The anon key is designed to be public and ships in the browser bundle. It is
not a secret and is not what protects your data — the policies and functions in
the schema are. Never put the `service_role` key in this file or anywhere else
the client can reach.

---

## 3. Check the storage bucket

Under **Storage** you should see `arrow-profile-photos`, marked **Private**,
limited to 5 MB and to JPEG/PNG/WebP.

It must stay private. A public bucket would make every profile photo on the
site enumerable by URL, and would let someone keep loading a saved photo URL
after being blocked. The app requests short-lived signed URLs instead, and the
signing itself is authorized by the same rule that governs profiles.

---

## 4. Run the security tests

The schema ships with an executable test suite. Run it against a scratch
database — never production, as it writes fixtures:

```bash
psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
```

It logs in as several separate users and asserts 86 properties, including that an
attacker who knows a match id cannot read its messages or its phone number,
that a user cannot set their own `is_verified_adult`, and that a blocked
person disappears in both directions. Every assertion that represents an attack
passes only when the attack fails.

---

## 5. Realtime: lock down typing indicators

Typing indicators use Realtime Broadcast on private channels, authorized by a
policy the schema installs on `realtime.messages`. Under **Project Settings →
Realtime**, turn **off** "Allow public access". If it stays on, a client can
simply ask for a public channel and skip the policy.

---

## 6. Payments with Paystack (optional — the app works without them)

ARROW takes payments through **Paystack**, because Stripe does not open
accounts for Kenyan businesses (its country list routes Kenya to Paystack,
which Stripe owns). Paystack Kenya supports cards and **M-Pesa**.

How the two methods behave — and this is what the app tells people:

| | Card | M-Pesa |
| --- | --- | --- |
| What it buys | A monthly subscription | A 30-day pass |
| Renews by itself | Yes, until cancelled | **Never** — mobile money cannot be charged automatically |
| Cancel | In the app: Membership → Cancel renewal. Keeps working to the end of the paid month | Nothing to cancel |
| Pay again | — | Adds 30 days to the end of a running pass |

Until the steps below are done, the Membership screen still shows every price
and feature, the free trial still works, and "Pay" explains that payments are
not set up yet.

1. Open a Paystack account for the business (Eden / your registered company)
   and complete its verification. Payouts go to your Kenyan bank or M-Pesa.
2. In Paystack → **Plans**, create two **monthly** plans in **KES**: Plus and
   Premium. Their amounts must equal `PRICE_KES` in `src/config/plans.ts`
   (currently 499 and 999). Copy each plan code (`PLN_…`).
3. Deploy the functions with the [Supabase CLI](https://supabase.com/docs/guides/cli):

   ```bash
   supabase functions deploy billing
   supabase functions deploy paystack-webhook --no-verify-jwt
   ```

   `--no-verify-jwt` is for the webhook only: Paystack does not send a Supabase
   login. The function checks Paystack's signature instead, then re-fetches
   every charge from Paystack's API and checks its amount and currency before
   granting anything.
4. Set the secrets (use your **test** keys first):

   ```bash
   supabase secrets set \
     PAYSTACK_SECRET_KEY=sk_test_... \
     PAYSTACK_PLAN_PLUS=PLN_... \
     PAYSTACK_PLAN_PREMIUM=PLN_... \
     PRICE_PLUS_KES=499 \
     PRICE_PREMIUM_KES=999 \
     APP_URL=https://your-site.example
   ```

   `APP_URL` is where people return after paying, and the only origin allowed
   to call the billing function. Never put any of these in `.env.local` — the
   secret key must never reach the browser.
5. In Paystack → Settings → **API Keys & Webhooks**, set the webhook URL to
   `https://<project-ref>.supabase.co/functions/v1/paystack-webhook`.
6. In Paystack → Settings → **Preferences**, enable **mobile money** for Kenya
   and keep **customer receipts** switched on — the app tells people Paystack
   emails them a receipt.

**If you change a price**, change it in three places: the Paystack plan, the
`PRICE_*_KES` secret and `PRICE_KES` in `src/config/plans.ts`. Tell existing
card subscribers at least 30 days ahead (Terms, section 7). The webhook refuses
to grant a plan for any payment below the configured price.

**Test it end to end** with Paystack's test cards and test M-Pesa number before
switching to live keys, and check the payment appears under Membership →
Payment history.

---

## 7. How many people can this handle?

Supabase's own limits, current at the time of writing (check
[supabase.com/pricing](https://supabase.com/pricing) before you plan around them):

| | Free | Pro ($25/month) |
| --- | --- | --- |
| Monthly active users (auth) | 50,000 | 100,000, then $0.00325 each |
| Database size | 500 MB | 8 GB, then $0.125/GB |
| File storage (photos) | 1 GB | 100 GB |
| Bandwidth | 5 GB | 250 GB |
| People connected to Realtime at once | 200 | 500, then $10 per 1,000 |
| Pauses when idle | after 1 week | never |

What that means for ARROW in practice:

- **Accounts are not the bottleneck.** 50,000 monthly users is far beyond where
  the other limits bite.
- **Photos run out first on Free.** Photos are now compressed on the phone to
  about 150–300 KB, so six photos is roughly 1–2 MB a person: about **500–1,000
  fully set-up profiles** in 1 GB. Pro's 100 GB holds roughly 50,000–100,000.
- **Bandwidth is next.** Everyone browsing loads everyone else's photos. Expect
  Free's 5 GB a month to support a few hundred active users; Pro's 250 GB
  supports roughly 10,000–20,000 active users a month.
- **Chat concurrency.** Each person with the app open holds one Realtime
  connection, so Free supports about **200 people online at the same moment**,
  Pro 500 before per-thousand charges.
- **The database itself** (profiles, likes, messages) is small: about 1 KB per
  profile, about 250 bytes per like and 300 bytes per message. 500 MB holds
  well over a million messages.

**Rule of thumb:** Free is right for testing and a launch with up to a few
hundred people. Move to Pro before you advertise — partly for the limits, and
because Free projects pause after a quiet week, which would take the app
offline.

---

## How the security model works

Read this before changing anything in `supabase/schema.sql`.

**Identity is never a parameter.** Every write and every cross-user read goes
through a `SECURITY DEFINER` function that derives the actor from `auth.uid()`.
No client-facing function takes a "current user" argument, so asking for
someone else's data simply authorizes you as yourself. This is what closes the
IDOR surface at its root rather than patching it per endpoint.

**Base tables are read-only to clients, scoped to your own rows.** There is no
`UPDATE` policy on `arrow_profiles` at all. That is deliberate: with one, a user
could set `is_verified_adult` on their own row and walk through the 18+ gate, or
clear their own ban.

**One visibility rule.** `arrow_can_view_profile` decides whether A may see B —
own profile, live in discovery, they liked you, or you matched, minus a block in
either direction. Profiles, photos and storage objects all defer to it, so there
is a single function to audit rather than a rule repeated in four places.

**Private fields cannot leak by accident.** `arrow_safe_profile` never selects
`date_of_birth` or `whatsapp_number`, so no caller mistake can surface them. The
phone number is returned by exactly one function, only to a confirmed match, and
only while its owner has opted in.

**Abuse limits live in the database.** Daily arrows, hourly messages, report
caps and photo caps are enforced in `arrow_limit` and the functions that read
it, not in the UI, so a modified client cannot exceed them. Adjust the numbers
in one place.

**Paid features are enforced like everything else.** `arrow_effective_plan`
reads the subscription row and checks expiry on every call, so a lapsed plan is
free again with no clean-up job, and `arrow_plan_has` / `arrow_plan_limit` are
the single list of what each plan unlocks. Subscription rows have no client
grants at all: only `arrow_record_payment` and
`arrow_apply_card_subscription`, callable by `service_role` alone, can write
them. Payments are recorded once per Paystack reference, so a webhook that is
delivered twice cannot grant time twice, and cancelling never removes time
already paid for. "See who liked you" is withheld by the server, not
blurred in the browser: free accounts receive a count, never the identities,
and the `arrow_likes` table no longer lets you list arrows pointed at you.

**Internal helpers are not granted to anyone.** `arrow_actor`,
`arrow_can_view_profile`, `arrow_safe_profile` and `arrow_match_partner` take a
user id as an argument. Granting them to `authenticated` would hand back exactly
the IDOR the RPC layer removes. The grant block at the end of the schema is
default-deny and lists the client API explicitly.

---

## Verify coexistence

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

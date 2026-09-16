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
   NOTICE: ARROW schema installed: 9 tables, 41 functions, RLS active on all.
   ```

   If you see an error instead, nothing was half-applied — fix the cause and run
   it again. The script is idempotent, so re-running it is always safe and is
   also how you upgrade an existing install.

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

It logs in as three separate users and asserts 38 properties, including that an
attacker who knows a match id cannot read its messages or its phone number,
that a user cannot set their own `is_verified_adult`, and that a blocked
person disappears in both directions. Every assertion that represents an attack
passes only when the attack fails.

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

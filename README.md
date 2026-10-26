# ARROW

A dating web app built on React, Vite and Supabase. People discover each other,
send arrows, match on mutual interest, and talk in the app before deciding
whether to share a phone number. It installs to a phone's home screen like a
native app.

Created by Eden.

## Running locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev
```

Without Supabase credentials the app runs against a local in-browser store,
which is enough to click through the interface. For real accounts, matching and
messaging, follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) and put your project
URL and publishable key in `.env.local`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm run lint` | TypeScript check (now with React types installed, so components are actually checked) |
| `npm run check:contrast` | Measures the palette against WCAG AA in both themes (needs the dev server running) |
| `npm run test:db` | Runs the database security suite against `$PGDATABASE` |
| `npm run test:db:local` | Same suite in an in-process Postgres (PGlite) — no database needed |

## Where things live

| Path | Contains |
| --- | --- |
| `supabase/schema.sql` | Tables, policies and the entire client API as RPCs |
| `supabase/tests/security.sql` | 86 assertions covering the authorization, membership and payment rules |
| `supabase/functions/` | Edge Functions for Paystack checkout (M-Pesa and card) and the payment webhook |
| `src/config/plans.ts` | Membership names, display prices and the feature table |
| `src/content/legal.ts` | Terms, Privacy Policy and safety copy (fill in `LEGAL_CONTACT` before launch) |
| `src/services/` | Thin wrappers over those RPCs |
| `src/styles/theme.css` | Design tokens for both themes |

## Memberships

ARROW is freemium. **Free** is the whole core product: 50 arrows and 1 super
arrow a day, unlimited messaging with matches, and every safety tool. **Plus**
reveals everyone who liked you and lifts the daily limits. **Premium** adds a
weekly boost, incognito mode and read receipts. Each account can take one
7-day Plus trial.

People pay through **Paystack**: by **M-Pesa** for a 30-day pass that never
renews, or by **card** for a monthly subscription they can cancel in the app.
Prices, every feature, how paying works, payment history and an FAQ are all on
the Membership screen, reachable from the header, the sidebar, the Profile
tab, every paywall, the sign-in screen and the link `/#pricing`.

Every one of those rules is enforced in the database, not the UI. Plans are
written only by the Paystack webhook running with the service-role key, so a
modified client cannot grant itself anything. See *Payments* in
[SUPABASE_SETUP.md](SUPABASE_SETUP.md) to switch billing on.

## Security model in one paragraph

The database, not the client, decides who may see whom. Every write and
cross-user read runs through a `SECURITY DEFINER` function that takes its actor
from `auth.uid()`, so no API call carries a user id that could be swapped for
someone else's. Base tables are read-only to clients and scoped to their own
rows. `SUPABASE_SETUP.md` explains the reasoning; `supabase/tests/security.sql`
demonstrates it by attacking the schema and asserting that each attempt fails.

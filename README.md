# ARROW

A dating app built on React, Vite and Supabase. People discover each other,
send arrows, match on mutual interest, and talk in the app before deciding
whether to share a phone number.

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
| `npm run lint` | TypeScript check |
| `npm run check:contrast` | Measures the palette against WCAG AA in both themes (needs the dev server running) |
| `npm run test:db` | Runs the database security suite against `$PGDATABASE` |

## Where things live

| Path | Contains |
| --- | --- |
| `supabase/schema.sql` | Tables, policies and the entire client API as RPCs |
| `supabase/tests/security.sql` | 37 assertions covering the authorization rules |
| `src/services/` | Thin wrappers over those RPCs |
| `src/styles/theme.css` | Design tokens for both themes |

## Security model in one paragraph

The database, not the client, decides who may see whom. Every write and
cross-user read runs through a `SECURITY DEFINER` function that takes its actor
from `auth.uid()`, so no API call carries a user id that could be swapped for
someone else's. Base tables are read-only to clients and scoped to their own
rows. `SUPABASE_SETUP.md` explains the reasoning; `supabase/tests/security.sql`
demonstrates it by attacking the schema and asserting that each attempt fails.

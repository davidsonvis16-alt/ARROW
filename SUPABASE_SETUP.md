# Supabase Setup Guide for ARROW (Additive Schema Migration)

Follow these steps to connect your ARROW dating application to Supabase.

> **Coexistence Guarantee**:
> If this Supabase project contains existing application tables (such as `categories`, `menu_items`, `orders`, `reservations`), this migration is **100% additive**. It prefixes every dating table with `arrow_`, uses the isolated `arrow-profile-photos` storage bucket, and never alters or interferes with existing tables or their policies.

---

### Step 1: Open SQL Editor in Supabase
1. Log in to [Supabase](https://supabase.com/) and navigate to your project dashboard.
2. In the left navigation menu, click on the **SQL Editor** icon (`_>`).
3. Click **+ New Query**.

---

### Step 2: Run `supabase/schema.sql`
1. Open `supabase/schema.sql` from this repository.
2. Copy its entire content and paste it into the Supabase SQL Editor.
3. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
4. You will see a success message (`Success. No rows returned`). This provisions:
   - **Tables**: `arrow_profiles`, `arrow_profile_photos`, `arrow_preferences`, `arrow_likes`, `arrow_matches`, `arrow_blocks`, `arrow_reports`
   - **Constraints**: Enforcing 18+ adult age, non-self likes/blocks, unique ordering
   - **Indexes**: Fast indexing for discovery, gender preferences, and match lookups
     - **Functions & Views**: `arrow_discoverable_profiles` (internal), `arrow_get_discover_feed`, `arrow_get_match_whatsapp_contact`, `arrow_can_view_profile_photo` (internal helper)
     - **Automated Triggers**: Instant mutual like match creation (`arrow_trigger_mutual_like_match`) and block cleanup (`arrow_trigger_block_cleanup`)
     - **Row Level Security (RLS)**: Strict RLS on all `arrow_*` tables. Profile raw data is never exposed directly; discovery happens only through `arrow_get_discover_feed`.
     - **Storage Bucket**: Dedicated private `arrow-profile-photos` bucket with owner-managed upload policies and authenticated access controls. Photo visibility is controlled by `arrow_can_view_profile_photo` to respect blocks.

---

### Step 3: Verify the `arrow-profile-photos` Storage Bucket
1. In the left navigation, click on **Storage** (bucket icon).
2. You will see the bucket named **`arrow-profile-photos`** (created automatically by the SQL script).
3. Ensure it is marked as **Private** with allowed MIME types (`image/jpeg, image/png, image/webp`) and a 5MB size limit.

---

### Step 4: Copy Supabase Project URL & Anon Key
1. In the left sidebar, click **Project Settings** (gear icon) > **API**.
2. Under **Project URL**, copy the URL (e.g. `https://your-project-ref.supabase.co`).
3. Under **Project API keys**, locate the **`anon` `public`** key and copy it.

---

### Step 5: Add Credentials to `.env.local`
In the root directory of your project, add the variables to `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

---

### Step 6: Verify Additive Coexistence
Run this query in SQL Editor to confirm that both ARROW tables and any existing restaurant tables coexist cleanly:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

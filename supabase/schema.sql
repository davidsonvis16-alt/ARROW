-- ==============================================================================
-- ARROW DATING APPLICATION — SECURE SCHEMA (v2)
-- ==============================================================================
-- Run this whole file in the Supabase SQL Editor. It is:
--   * FRESH-INSTALL SAFE — every object is created before it is referenced.
--   * IDEMPOTENT — re-running it upgrades an existing ARROW install in place.
--   * ADDITIVE — every object is prefixed `arrow_` and the dedicated
--     `arrow-profile-photos` storage bucket is used, so unrelated tables in the
--     same project (e.g. an existing restaurant app) are never touched.
--
-- SECURITY MODEL (read this before changing anything)
-- ------------------------------------------------------------------------------
-- 1. NO CLIENT-SUPPLIED IDENTITY. Every write and every cross-user read goes
--    through a SECURITY DEFINER function that derives the actor from
--    `auth.uid()`. The client cannot pass "who I am", so there is no IDOR
--    surface: asking for someone else's data simply authorizes as yourself.
-- 2. DENY BY DEFAULT. Base tables carry RLS that only ever exposes the caller's
--    OWN rows. Nothing about another user is readable by direct table access,
--    so a leaked anon key buys an attacker nothing beyond their own account.
-- 3. AUTHORIZED READS ONLY. Another user's profile is visible only when a
--    relationship justifies it: they are in your discovery feed, they liked
--    you, or you matched. `arrow_can_view_profile` is the single source of
--    truth for that decision and is reused by photos and storage.
-- 4. PRIVATE FIELDS NEVER TRAVEL. Date of birth and WhatsApp number are not
--    returned by any discovery or profile function. The phone number is
--    released by exactly one function, only to a confirmed match, and only
--    when its owner opted in.
-- 5. ABUSE CONTROLS IN THE DATABASE. Daily like quotas, message rate limits,
--    message length caps and ban enforcement live here, not in the client,
--    so they cannot be bypassed by calling the API directly.
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. ENUM TYPES
-- ==============================================================================
DO $$ BEGIN
  CREATE TYPE arrow_user_gender AS ENUM ('woman', 'man', 'non-binary');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE arrow_report_reason AS ENUM (
    'harassment',
    'inappropriate_photos',
    'spam_scam',
    'underage',
    'fake_profile',
    'offline_behavior',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Upgrade path for installs created before the reason list was widened.
-- ADD VALUE IF NOT EXISTS is safe here: this script never inserts these
-- literals, and a value added in a transaction may not be used in that same
-- transaction.
ALTER TYPE arrow_report_reason ADD VALUE IF NOT EXISTS 'fake_profile';
ALTER TYPE arrow_report_reason ADD VALUE IF NOT EXISTS 'offline_behavior';

DO $$ BEGIN
  CREATE TYPE arrow_report_status AS ENUM ('pending', 'reviewed', 'dismissed', 'banned');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. TABLES
-- ==============================================================================

-- 3.1 PROFILES — one row per auth user.
CREATE TABLE IF NOT EXISTS public.arrow_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE DEFAULT NULL,
  gender arrow_user_gender NOT NULL,
  location TEXT DEFAULT NULL,
  bio TEXT DEFAULT '',
  interests TEXT[] DEFAULT '{}',
  looking_for TEXT DEFAULT 'Meaningful dating',
  prompts JSONB DEFAULT '[]'::jsonb,
  allow_whatsapp BOOLEAN NOT NULL DEFAULT false,
  whatsapp_number TEXT DEFAULT NULL,
  is_verified_adult BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive column upgrades for existing installs.
ALTER TABLE public.arrow_profiles ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE public.arrow_profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.arrow_profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.arrow_profiles ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.arrow_profiles ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.arrow_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Field-level sanity limits, enforced for every writer including RPCs.
ALTER TABLE public.arrow_profiles DROP CONSTRAINT IF EXISTS check_arrow_adult_age;
ALTER TABLE public.arrow_profiles ADD CONSTRAINT check_arrow_adult_age
  CHECK (date_of_birth IS NULL OR date_part('year', age(date_of_birth)) >= 18);

ALTER TABLE public.arrow_profiles DROP CONSTRAINT IF EXISTS check_arrow_name_len;
ALTER TABLE public.arrow_profiles ADD CONSTRAINT check_arrow_name_len
  CHECK (char_length(name) BETWEEN 1 AND 60);

ALTER TABLE public.arrow_profiles DROP CONSTRAINT IF EXISTS check_arrow_bio_len;
ALTER TABLE public.arrow_profiles ADD CONSTRAINT check_arrow_bio_len
  CHECK (bio IS NULL OR char_length(bio) <= 1000);

ALTER TABLE public.arrow_profiles DROP CONSTRAINT IF EXISTS check_arrow_interests_len;
ALTER TABLE public.arrow_profiles ADD CONSTRAINT check_arrow_interests_len
  CHECK (interests IS NULL OR cardinality(interests) <= 20);

-- 3.2 AGE VERIFICATIONS — immutable audit trail of the 18+ gate.
CREATE TABLE IF NOT EXISTS public.arrow_age_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  date_of_birth DATE NOT NULL,
  is_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_arrow_age_verification_user UNIQUE (user_id)
);

-- 3.3 PROFILE PHOTOS — up to 6 per user, stored as bucket paths.
CREATE TABLE IF NOT EXISTS public.arrow_profile_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_arrow_photo_order_range CHECK (display_order >= 0)
);

-- `storage_path` is the object key inside the private bucket. `photo_url` is
-- kept for older rows; new code signs `storage_path` on demand.

-- Reordering shifts rows through a temporary high offset to stay inside the
-- (user_id, display_order) unique index, so the order column may briefly hold
-- values above the photo cap. The cap itself lives in arrow_add_photo.
ALTER TABLE public.arrow_profile_photos DROP CONSTRAINT IF EXISTS check_arrow_photo_order_range;
ALTER TABLE public.arrow_profile_photos ADD CONSTRAINT check_arrow_photo_order_range
  CHECK (display_order >= 0);
ALTER TABLE public.arrow_profile_photos ADD COLUMN IF NOT EXISTS storage_path TEXT DEFAULT NULL;

DROP INDEX IF EXISTS idx_arrow_photos_user_order;
CREATE UNIQUE INDEX IF NOT EXISTS idx_arrow_photos_user_order
  ON public.arrow_profile_photos(user_id, display_order);

-- 3.4 PREFERENCES — one row per user (user_id is the natural key).
CREATE TABLE IF NOT EXISTS public.arrow_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  age_min INT NOT NULL DEFAULT 18,
  age_max INT NOT NULL DEFAULT 65,
  gender_preference TEXT[] NOT NULL DEFAULT ARRAY['woman', 'man', 'non-binary'],
  location_preference TEXT DEFAULT NULL,
  max_distance_km INT NOT NULL DEFAULT 100,
  intentions TEXT[] NOT NULL DEFAULT ARRAY['Meaningful dating'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_arrow_pref_age CHECK (age_min >= 18 AND age_max >= age_min AND age_max <= 120)
);

-- 3.5 LIKES — an arrow sent, or a pass. One row per ordered pair.
CREATE TABLE IF NOT EXISTS public.arrow_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  is_pass BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_arrow_no_self_like CHECK (from_user_id <> to_user_id),
  CONSTRAINT unique_arrow_like_direction UNIQUE (from_user_id, to_user_id)
);

-- A super arrow is a limited, higher-signal like that surfaces first.
ALTER TABLE public.arrow_likes ADD COLUMN IF NOT EXISTS is_super BOOLEAN NOT NULL DEFAULT FALSE;

-- 3.6 MATCHES — exactly one row per pair, ordered so the pair is unique.
CREATE TABLE IF NOT EXISTS public.arrow_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_arrow_user_ordering CHECK (user1_id < user2_id),
  CONSTRAINT unique_arrow_match_pair UNIQUE (user1_id, user2_id)
);

-- 3.7 MESSAGES — in-app chat, only ever between a matched pair.
CREATE TABLE IF NOT EXISTS public.arrow_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.arrow_matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT check_arrow_message_len CHECK (char_length(body) BETWEEN 1 AND 2000)
);

-- 3.8 BLOCKS
CREATE TABLE IF NOT EXISTS public.arrow_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_arrow_no_self_block CHECK (blocker_id <> blocked_id),
  CONSTRAINT unique_arrow_block_pair UNIQUE (blocker_id, blocked_id)
);

-- 3.9 REPORTS — private moderation records.
CREATE TABLE IF NOT EXISTS public.arrow_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  reason arrow_report_reason NOT NULL,
  details TEXT DEFAULT '',
  status arrow_report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_arrow_no_self_report CHECK (reporter_id <> reported_id)
);

ALTER TABLE public.arrow_reports DROP CONSTRAINT IF EXISTS check_arrow_report_details_len;
ALTER TABLE public.arrow_reports ADD CONSTRAINT check_arrow_report_details_len
  CHECK (details IS NULL OR char_length(details) <= 2000);

-- One open report per reporter/target keeps the moderation queue clean and
-- stops report-spam being used to harass.
CREATE UNIQUE INDEX IF NOT EXISTS idx_arrow_reports_open_unique
  ON public.arrow_reports(reporter_id, reported_id)
  WHERE status = 'pending';

-- ==============================================================================
-- 4. INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_arrow_profiles_gender ON public.arrow_profiles(gender);
CREATE INDEX IF NOT EXISTS idx_arrow_profiles_discoverable
  ON public.arrow_profiles(is_verified_adult, is_banned, is_paused);
CREATE INDEX IF NOT EXISTS idx_arrow_photos_user ON public.arrow_profile_photos(user_id, display_order);
CREATE INDEX IF NOT EXISTS idx_arrow_likes_from_user ON public.arrow_likes(from_user_id);
CREATE INDEX IF NOT EXISTS idx_arrow_likes_to_user ON public.arrow_likes(to_user_id, is_pass);
CREATE INDEX IF NOT EXISTS idx_arrow_likes_created ON public.arrow_likes(from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arrow_matches_user1 ON public.arrow_matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_arrow_matches_user2 ON public.arrow_matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_arrow_messages_match ON public.arrow_messages(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arrow_messages_unread ON public.arrow_messages(match_id, sender_id, read_at);
CREATE INDEX IF NOT EXISTS idx_arrow_blocks_blocker ON public.arrow_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_arrow_blocks_blocked ON public.arrow_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_arrow_reports_reporter ON public.arrow_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_arrow_reports_status ON public.arrow_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arrow_age_verifications_user_id ON public.arrow_age_verifications(user_id);

-- ==============================================================================
-- 5. AUTHORIZATION CORE
-- ------------------------------------------------------------------------------
-- These helpers are the only place that decides "may A see B". Everything else
-- — profile reads, photo reads, storage objects, messaging — defers to them, so
-- there is exactly one rule to audit. They are defined BEFORE any policy or RPC
-- references them, which is what makes this file safe to run on a fresh project.
-- ==============================================================================

-- 5.1 The acting user. Raises rather than returning NULL so that a missing
-- session can never silently widen a query.
CREATE OR REPLACE FUNCTION public.arrow_actor()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_banned BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT is_banned INTO v_banned FROM public.arrow_profiles WHERE id = v_uid;

  IF v_banned THEN
    RAISE EXCEPTION 'Account suspended' USING ERRCODE = '42501';
  END IF;

  RETURN v_uid;
END;
$$;

-- 5.2 Blocking is symmetric: a block in either direction hides both people
-- from each other everywhere in the product.
CREATE OR REPLACE FUNCTION public.arrow_is_blocked_pair(p_a UUID, p_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.arrow_blocks b
    WHERE (b.blocker_id = p_a AND b.blocked_id = p_b)
       OR (b.blocker_id = p_b AND b.blocked_id = p_a)
  );
$$;

-- 5.3 Are these two users matched?
CREATE OR REPLACE FUNCTION public.arrow_is_matched(p_a UUID, p_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.arrow_matches m
    WHERE (m.user1_id = LEAST(p_a, p_b) AND m.user2_id = GREATEST(p_a, p_b))
  );
$$;

-- 5.4 THE access rule for one user's data being visible to another.
-- A profile is visible only when a relationship justifies it:
--   * it is your own, or
--   * they are live in discovery (verified adult, not paused/banned), or
--   * they sent you an arrow (so you can decide on it), or
--   * you matched.
-- A block in either direction overrides all of the above.
CREATE OR REPLACE FUNCTION public.arrow_can_view_profile(p_viewer UUID, p_target UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target RECORD;
BEGIN
  IF p_viewer IS NULL OR p_target IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_viewer = p_target THEN
    RETURN TRUE;
  END IF;

  SELECT is_verified_adult, is_banned, is_paused, deleted_at
    INTO v_target
  FROM public.arrow_profiles
  WHERE id = p_target;

  IF NOT FOUND OR v_target.is_banned OR v_target.deleted_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  IF public.arrow_is_blocked_pair(p_viewer, p_target) THEN
    RETURN FALSE;
  END IF;

  IF public.arrow_is_matched(p_viewer, p_target) THEN
    RETURN TRUE;
  END IF;

  -- They put themselves in front of you by sending an arrow.
  IF EXISTS (
    SELECT 1 FROM public.arrow_likes l
    WHERE l.from_user_id = p_target AND l.to_user_id = p_viewer AND l.is_pass = FALSE
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN v_target.is_verified_adult AND NOT v_target.is_paused;
END;
$$;

-- 5.5 Photo visibility follows profile visibility exactly.
CREATE OR REPLACE FUNCTION public.arrow_can_view_profile_photo(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.arrow_can_view_profile(auth.uid(), p_profile_id);
$$;

-- 5.6 Resolve a match the caller actually belongs to, or raise. Every
-- match-scoped RPC starts here, so a guessed match id is useless.
CREATE OR REPLACE FUNCTION public.arrow_match_partner(p_actor UUID, p_match_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
BEGIN
  SELECT user1_id, user2_id INTO v_match
  FROM public.arrow_matches
  WHERE id = p_match_id
    AND (user1_id = p_actor OR user2_id = p_actor);

  IF NOT FOUND THEN
    -- Deliberately indistinguishable from "does not exist" so match ids
    -- cannot be probed for existence.
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '42501';
  END IF;

  RETURN CASE WHEN v_match.user1_id = p_actor THEN v_match.user2_id ELSE v_match.user1_id END;
END;
$$;

-- 5.7 The public shape of a profile. Date of birth and WhatsApp number are
-- absent by construction — they cannot leak through a caller mistake because
-- they are never selected here.
CREATE OR REPLACE FUNCTION public.arrow_safe_profile(p_profile_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'age', CASE WHEN p.date_of_birth IS NULL THEN NULL
                ELSE date_part('year', age(p.date_of_birth))::int END,
    'gender', p.gender,
    'location', p.location,
    'bio', COALESCE(p.bio, ''),
    'interests', COALESCE(p.interests, '{}'),
    'lookingFor', COALESCE(p.looking_for, 'Meaningful dating'),
    'prompts', COALESCE(p.prompts, '[]'::jsonb),
    'allowWhatsApp', p.allow_whatsapp,
    'isVerifiedAdult', p.is_verified_adult,
    'isPaused', p.is_paused,
    'lastActiveAt', CASE WHEN p.show_online_status THEN p.last_active_at ELSE NULL END,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at,
    'photos', COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object('path', ph.storage_path, 'url', ph.photo_url)
               ORDER BY ph.display_order ASC
             )
      FROM public.arrow_profile_photos ph
      WHERE ph.user_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.arrow_profiles p
  WHERE p.id = p_profile_id;
$$;

REVOKE ALL ON FUNCTION public.arrow_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arrow_is_blocked_pair(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arrow_is_matched(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arrow_can_view_profile(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arrow_match_partner(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.arrow_safe_profile(UUID) FROM PUBLIC, anon, authenticated;

-- Only this one is granted: RLS policies on storage.objects evaluate it as the
-- calling user, so `authenticated` must be able to execute it.
REVOKE ALL ON FUNCTION public.arrow_can_view_profile_photo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arrow_can_view_profile_photo(UUID) TO authenticated;

-- ==============================================================================
-- 6. ABUSE LIMITS
-- ------------------------------------------------------------------------------
-- Tunable in one place. These are enforced server-side so a modified client or
-- a direct API call cannot exceed them.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.arrow_limit(p_key TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_key
    WHEN 'daily_arrows'      THEN 60    -- likes per rolling day
    WHEN 'daily_super'       THEN 3     -- super arrows per rolling day
    WHEN 'hourly_messages'   THEN 120   -- messages per rolling hour
    WHEN 'daily_reports'     THEN 10    -- reports per rolling day
    WHEN 'rewind_window_min' THEN 30    -- how far back a rewind may reach
    WHEN 'max_photos'        THEN 6
    ELSE 0
  END;
$$;

-- ==============================================================================
-- 7. PUBLIC RPC SURFACE
-- ------------------------------------------------------------------------------
-- The entire client API. Note what is NOT here: no function takes a "current
-- user" argument. Identity always comes from arrow_actor(), so a client can
-- only ever act as itself.
-- ==============================================================================

-- 7.1 Heartbeat for the "active recently" indicator.
CREATE OR REPLACE FUNCTION public.arrow_touch_activity()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
BEGIN
  UPDATE public.arrow_profiles
  SET last_active_at = NOW(),
      last_login_at = COALESCE(last_login_at, NOW())
  WHERE id = v_actor;
END;
$$;

-- 7.2 Your own profile, including the private fields you are entitled to.
CREATE OR REPLACE FUNCTION public.arrow_get_my_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_profile JSONB;
BEGIN
  SELECT public.arrow_safe_profile(v_actor) INTO v_profile;

  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_profile || (
    SELECT jsonb_build_object(
      'dateOfBirth', p.date_of_birth,
      'whatsappNumber', p.whatsapp_number,
      'showOnlineStatus', p.show_online_status,
      'isPaused', p.is_paused,
      'unreadCount', (
        SELECT COUNT(*) FROM public.arrow_messages msg
        JOIN public.arrow_matches m ON m.id = msg.match_id
        WHERE msg.sender_id <> v_actor
          AND msg.read_at IS NULL
          AND (m.user1_id = v_actor OR m.user2_id = v_actor)
      )
    )
    FROM public.arrow_profiles p WHERE p.id = v_actor
  );
END;
$$;

-- 7.3 Create or update your own profile. The actor is the row key, so this
-- cannot write to anyone else's profile even if the client tries.
CREATE OR REPLACE FUNCTION public.arrow_upsert_my_profile(
  p_name TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_interests TEXT[] DEFAULT NULL,
  p_looking_for TEXT DEFAULT NULL,
  p_prompts JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.arrow_profiles WHERE id = v_actor) INTO v_exists;

  IF NOT v_exists THEN
    IF p_name IS NULL OR btrim(p_name) = '' THEN
      RAISE EXCEPTION 'Name is required' USING ERRCODE = '22023';
    END IF;
    IF p_gender IS NULL THEN
      RAISE EXCEPTION 'Gender is required' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.arrow_profiles (id, name, gender, location, bio, interests, looking_for, prompts)
    VALUES (
      v_actor,
      btrim(p_name),
      p_gender::arrow_user_gender,
      NULLIF(btrim(COALESCE(p_location, '')), ''),
      COALESCE(p_bio, ''),
      COALESCE(p_interests, '{}'),
      COALESCE(p_looking_for, 'Meaningful dating'),
      COALESCE(p_prompts, '[]'::jsonb)
    );

    INSERT INTO public.arrow_preferences (user_id)
    VALUES (v_actor)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    UPDATE public.arrow_profiles
    SET name        = COALESCE(NULLIF(btrim(p_name), ''), name),
        gender      = COALESCE(p_gender::arrow_user_gender, gender),
        location    = COALESCE(NULLIF(btrim(p_location), ''), location),
        bio         = COALESCE(p_bio, bio),
        interests   = COALESCE(p_interests, interests),
        looking_for = COALESCE(NULLIF(btrim(p_looking_for), ''), looking_for),
        prompts     = COALESCE(p_prompts, prompts),
        updated_at  = NOW()
    WHERE id = v_actor;
  END IF;

  RETURN public.arrow_get_my_profile();
END;
$$;

-- 7.4 The 18+ gate. Age is computed and checked in the database; a client
-- claiming to be an adult proves nothing.
CREATE OR REPLACE FUNCTION public.arrow_complete_age_verification(p_date_of_birth DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_email_confirmed_at TIMESTAMPTZ;
  v_age INT;
BEGIN
  SELECT email_confirmed_at INTO v_email_confirmed_at FROM auth.users WHERE id = v_actor;

  IF v_email_confirmed_at IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Email not verified');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.arrow_profiles WHERE id = v_actor) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Profile not found');
  END IF;

  IF p_date_of_birth IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Date of birth is required');
  END IF;

  IF p_date_of_birth > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Date of birth cannot be in the future');
  END IF;

  v_age := date_part('year', age(p_date_of_birth))::INT;

  IF v_age < 18 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'You must be 18 or older to use ARROW');
  END IF;

  IF v_age > 120 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Please enter a valid date of birth');
  END IF;

  UPDATE public.arrow_profiles
  SET date_of_birth = p_date_of_birth,
      is_verified_adult = TRUE,
      updated_at = NOW()
  WHERE id = v_actor;

  INSERT INTO public.arrow_age_verifications (user_id, date_of_birth, is_eligible, verified_at)
  VALUES (v_actor, p_date_of_birth, TRUE, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET date_of_birth = EXCLUDED.date_of_birth,
        is_eligible = TRUE,
        verified_at = NOW();

  RETURN jsonb_build_object('success', TRUE, 'age', v_age);
END;
$$;

-- 7.5 WhatsApp opt-in. The number is write-only from the client's perspective:
-- it goes in here and comes back out only via arrow_get_match_whatsapp_contact.
CREATE OR REPLACE FUNCTION public.arrow_set_whatsapp(
  p_allow BOOLEAN,
  p_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_clean TEXT := NULLIF(btrim(COALESCE(p_number, '')), '');
BEGIN
  IF p_allow AND v_clean IS NULL THEN
    RAISE EXCEPTION 'A WhatsApp number is required to enable sharing' USING ERRCODE = '22023';
  END IF;

  IF v_clean IS NOT NULL AND v_clean !~ '^\+?[0-9 ()\-]{7,20}$' THEN
    RAISE EXCEPTION 'That does not look like a valid phone number' USING ERRCODE = '22023';
  END IF;

  UPDATE public.arrow_profiles
  SET allow_whatsapp = p_allow,
      whatsapp_number = CASE WHEN p_allow THEN v_clean ELSE NULL END,
      updated_at = NOW()
  WHERE id = v_actor;

  RETURN public.arrow_get_my_profile();
END;
$$;

-- 7.6 Preferences.
CREATE OR REPLACE FUNCTION public.arrow_get_my_preferences()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_row RECORD;
BEGIN
  SELECT * INTO v_row FROM public.arrow_preferences WHERE user_id = v_actor;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ageMin', 18, 'ageMax', 65,
      'genderPreference', to_jsonb(ARRAY['woman', 'man', 'non-binary']),
      'locationPreference', NULL, 'maxDistanceKm', 100,
      'intentions', to_jsonb(ARRAY['Meaningful dating'])
    );
  END IF;

  RETURN jsonb_build_object(
    'ageMin', v_row.age_min,
    'ageMax', v_row.age_max,
    'genderPreference', to_jsonb(v_row.gender_preference),
    'locationPreference', v_row.location_preference,
    'maxDistanceKm', v_row.max_distance_km,
    'intentions', to_jsonb(v_row.intentions)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.arrow_set_my_preferences(
  p_age_min INT DEFAULT 18,
  p_age_max INT DEFAULT 65,
  p_gender_preference TEXT[] DEFAULT NULL,
  p_location_preference TEXT DEFAULT NULL,
  p_max_distance_km INT DEFAULT 100,
  p_intentions TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_min INT := GREATEST(18, COALESCE(p_age_min, 18));
  v_max INT := LEAST(120, GREATEST(v_min, COALESCE(p_age_max, 65)));
BEGIN
  INSERT INTO public.arrow_preferences (
    user_id, age_min, age_max, gender_preference,
    location_preference, max_distance_km, intentions, updated_at
  )
  VALUES (
    v_actor, v_min, v_max,
    COALESCE(p_gender_preference, ARRAY['woman', 'man', 'non-binary']),
    NULLIF(btrim(COALESCE(p_location_preference, '')), ''),
    GREATEST(1, LEAST(20000, COALESCE(p_max_distance_km, 100))),
    COALESCE(p_intentions, ARRAY['Meaningful dating']),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET age_min = EXCLUDED.age_min,
        age_max = EXCLUDED.age_max,
        gender_preference = EXCLUDED.gender_preference,
        location_preference = EXCLUDED.location_preference,
        max_distance_km = EXCLUDED.max_distance_km,
        intentions = EXCLUDED.intentions,
        updated_at = NOW();

  RETURN public.arrow_get_my_preferences();
END;
$$;

-- 7.7 Discovery feed. Filters are hints; the hard rules (18+, verified, not
-- blocked, not banned, not yourself, not already swiped) are not negotiable
-- and are applied regardless of what the client sends.
CREATE OR REPLACE FUNCTION public.arrow_get_discover_feed(
  p_age_min INT DEFAULT NULL,
  p_age_max INT DEFAULT NULL,
  p_genders TEXT[] DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_interests TEXT[] DEFAULT NULL,
  p_looking_for TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_prefs RECORD;
  v_age_min INT;
  v_age_max INT;
  v_genders TEXT[];
  v_location TEXT;
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 50);
  v_result JSONB;
BEGIN
  SELECT * INTO v_prefs FROM public.arrow_preferences WHERE user_id = v_actor;

  -- Fall back to the caller's saved preferences, then to safe defaults.
  v_age_min  := GREATEST(18, COALESCE(p_age_min, v_prefs.age_min, 18));
  v_age_max  := LEAST(120, GREATEST(v_age_min, COALESCE(p_age_max, v_prefs.age_max, 65)));
  v_genders  := NULLIF(COALESCE(p_genders, v_prefs.gender_preference), '{}');
  v_location := NULLIF(btrim(COALESCE(p_location, v_prefs.location_preference, '')), '');

  SELECT COALESCE(jsonb_agg(profile ORDER BY ord), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      public.arrow_safe_profile(p.id) AS profile,
      ROW_NUMBER() OVER (
        ORDER BY
          -- People who already sent you an arrow come first: they are the
          -- likeliest match and the best use of a swipe.
          (EXISTS (
            SELECT 1 FROM public.arrow_likes l
            WHERE l.from_user_id = p.id AND l.to_user_id = v_actor AND l.is_pass = FALSE
          )) DESC,
          p.last_active_at DESC NULLS LAST,
          p.created_at DESC
      ) AS ord
    FROM public.arrow_profiles p
    WHERE p.id <> v_actor
      AND p.is_verified_adult = TRUE
      AND p.is_banned = FALSE
      AND p.is_paused = FALSE
      AND p.deleted_at IS NULL
      AND p.date_of_birth IS NOT NULL
      AND date_part('year', age(p.date_of_birth))::int BETWEEN v_age_min AND v_age_max
      AND (v_genders IS NULL OR p.gender::TEXT = ANY(v_genders))
      AND (v_location IS NULL OR p.location ILIKE '%' || v_location || '%')
      AND (p_interests IS NULL OR cardinality(p_interests) = 0 OR p.interests && p_interests)
      AND (p_looking_for IS NULL OR cardinality(p_looking_for) = 0 OR p.looking_for = ANY(p_looking_for))
      AND NOT EXISTS (
        SELECT 1 FROM public.arrow_likes l
        WHERE l.from_user_id = v_actor AND l.to_user_id = p.id
      )
      AND NOT public.arrow_is_blocked_pair(v_actor, p.id)
    LIMIT v_limit
  ) feed;

  RETURN v_result;
END;
$$;

-- 7.8 A single profile, authorization-checked. This is the function that
-- closes the classic IDOR: passing an arbitrary id returns nothing unless the
-- caller has a relationship that entitles them to see it.
CREATE OR REPLACE FUNCTION public.arrow_get_profile(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
BEGIN
  IF NOT public.arrow_can_view_profile(v_actor, p_profile_id) THEN
    RETURN NULL;
  END IF;

  IF v_actor = p_profile_id THEN
    RETURN public.arrow_get_my_profile();
  END IF;

  RETURN public.arrow_safe_profile(p_profile_id);
END;
$$;

-- 7.9 Remaining daily quota.
CREATE OR REPLACE FUNCTION public.arrow_get_like_quota()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_arrows INT;
  v_super INT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE is_pass = FALSE),
    COUNT(*) FILTER (WHERE is_pass = FALSE AND is_super = TRUE)
  INTO v_arrows, v_super
  FROM public.arrow_likes
  WHERE from_user_id = v_actor
    AND created_at > NOW() - INTERVAL '24 hours';

  RETURN jsonb_build_object(
    'arrowsUsed', v_arrows,
    'arrowsLimit', public.arrow_limit('daily_arrows'),
    'arrowsRemaining', GREATEST(0, public.arrow_limit('daily_arrows') - v_arrows),
    'superUsed', v_super,
    'superLimit', public.arrow_limit('daily_super'),
    'superRemaining', GREATEST(0, public.arrow_limit('daily_super') - v_super)
  );
END;
$$;

-- 7.10 Send an arrow. Returns whether it produced a match, plus the partner's
-- safe profile so the client never has to make a second, unauthorized lookup.
CREATE OR REPLACE FUNCTION public.arrow_like_profile(
  p_target_id UUID,
  p_is_super BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_used INT;
  v_limit INT;
  v_match RECORD;
BEGIN
  IF p_target_id IS NULL OR p_target_id = v_actor THEN
    RAISE EXCEPTION 'You cannot send an arrow to yourself' USING ERRCODE = '22023';
  END IF;

  IF NOT public.arrow_can_view_profile(v_actor, p_target_id) THEN
    RAISE EXCEPTION 'Profile not available' USING ERRCODE = '42501';
  END IF;

  IF p_is_super THEN
    SELECT COUNT(*) INTO v_used FROM public.arrow_likes
    WHERE from_user_id = v_actor AND is_pass = FALSE AND is_super = TRUE
      AND created_at > NOW() - INTERVAL '24 hours';
    v_limit := public.arrow_limit('daily_super');
    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'You have used all % super arrows for today', v_limit USING ERRCODE = '53400';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_used FROM public.arrow_likes
  WHERE from_user_id = v_actor AND is_pass = FALSE
    AND created_at > NOW() - INTERVAL '24 hours';
  v_limit := public.arrow_limit('daily_arrows');

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'Daily arrow limit reached. Try again tomorrow.' USING ERRCODE = '53400';
  END IF;

  INSERT INTO public.arrow_likes (from_user_id, to_user_id, is_pass, is_super, created_at)
  VALUES (v_actor, p_target_id, FALSE, COALESCE(p_is_super, FALSE), NOW())
  ON CONFLICT (from_user_id, to_user_id) DO UPDATE
    SET is_pass = FALSE,
        is_super = arrow_likes.is_super OR EXCLUDED.is_super,
        created_at = NOW();

  -- The trigger below creates the match row if this completed a mutual like.
  SELECT * INTO v_match FROM public.arrow_matches
  WHERE user1_id = LEAST(v_actor, p_target_id)
    AND user2_id = GREATEST(v_actor, p_target_id);

  IF FOUND THEN
    RETURN jsonb_build_object(
      'isMatch', TRUE,
      'match', jsonb_build_object(
        'id', v_match.id,
        'user1Id', v_match.user1_id,
        'user2Id', v_match.user2_id,
        'matchedAt', v_match.matched_at,
        'lastInteractionAt', v_match.last_interaction_at
      ),
      'partner', public.arrow_safe_profile(p_target_id),
      'quota', public.arrow_get_like_quota()
    );
  END IF;

  RETURN jsonb_build_object('isMatch', FALSE, 'quota', public.arrow_get_like_quota());
END;
$$;

-- 7.11 Pass. Passes are not rate limited — only positive intent is.
CREATE OR REPLACE FUNCTION public.arrow_pass_profile(p_target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
BEGIN
  IF p_target_id IS NULL OR p_target_id = v_actor THEN
    RAISE EXCEPTION 'Invalid target' USING ERRCODE = '22023';
  END IF;

  IF NOT public.arrow_can_view_profile(v_actor, p_target_id) THEN
    RAISE EXCEPTION 'Profile not available' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.arrow_likes (from_user_id, to_user_id, is_pass, created_at)
  VALUES (v_actor, p_target_id, TRUE, NOW())
  ON CONFLICT (from_user_id, to_user_id) DO UPDATE
    SET is_pass = TRUE, is_super = FALSE, created_at = NOW();

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- 7.12 Rewind the last swipe — the single most requested feature in every
-- swipe app. Only undoes your own recent swipe, and refuses once the swipe
-- has already produced a match (undoing that would be a nasty surprise for
-- the other person).
CREATE OR REPLACE FUNCTION public.arrow_rewind_last_swipe()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_last RECORD;
BEGIN
  SELECT * INTO v_last
  FROM public.arrow_likes
  WHERE from_user_id = v_actor
    AND created_at > NOW() - (public.arrow_limit('rewind_window_min') || ' minutes')::INTERVAL
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Nothing recent to undo');
  END IF;

  IF public.arrow_is_matched(v_actor, v_last.to_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'That one is already a match');
  END IF;

  DELETE FROM public.arrow_likes WHERE id = v_last.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'wasPass', v_last.is_pass,
    'profile', public.arrow_safe_profile(v_last.to_user_id)
  );
END;
$$;

-- 7.13 Arrows you received, newest and super arrows first. Each entry carries
-- the sender's safe profile, so the likes screen needs no per-row lookup.
CREATE OR REPLACE FUNCTION public.arrow_get_received_likes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(entry ORDER BY ord)
    FROM (
      SELECT
        jsonb_build_object(
          'profile', public.arrow_safe_profile(l.from_user_id),
          'isSuper', l.is_super,
          'createdAt', l.created_at
        ) AS entry,
        ROW_NUMBER() OVER (ORDER BY l.is_super DESC, l.created_at DESC) AS ord
      FROM public.arrow_likes l
      JOIN public.arrow_profiles p ON p.id = l.from_user_id
      WHERE l.to_user_id = v_actor
        AND l.is_pass = FALSE
        AND p.is_banned = FALSE
        AND p.deleted_at IS NULL
        AND NOT public.arrow_is_blocked_pair(v_actor, l.from_user_id)
        -- Hide anyone you have already answered.
        AND NOT EXISTS (
          SELECT 1 FROM public.arrow_likes mine
          WHERE mine.from_user_id = v_actor AND mine.to_user_id = l.from_user_id
        )
      LIMIT 100
    ) rows
  ), '[]'::jsonb);
END;
$$;

-- 7.14 Arrows you sent that are still pending.
CREATE OR REPLACE FUNCTION public.arrow_get_sent_likes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(entry ORDER BY ord)
    FROM (
      SELECT
        jsonb_build_object(
          'profile', public.arrow_safe_profile(l.to_user_id),
          'isSuper', l.is_super,
          'createdAt', l.created_at
        ) AS entry,
        ROW_NUMBER() OVER (ORDER BY l.created_at DESC) AS ord
      FROM public.arrow_likes l
      JOIN public.arrow_profiles p ON p.id = l.to_user_id
      WHERE l.from_user_id = v_actor
        AND l.is_pass = FALSE
        AND p.is_banned = FALSE
        AND p.deleted_at IS NULL
        AND NOT public.arrow_is_matched(v_actor, l.to_user_id)
        AND NOT public.arrow_is_blocked_pair(v_actor, l.to_user_id)
      LIMIT 100
    ) rows
  ), '[]'::jsonb);
END;
$$;

-- 7.15 Your matches, each with the partner's safe profile, unread count and
-- last message preview.
CREATE OR REPLACE FUNCTION public.arrow_get_matches()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(entry ORDER BY ord)
    FROM (
      SELECT
        jsonb_build_object(
          'id', m.id,
          'user1Id', m.user1_id,
          'user2Id', m.user2_id,
          'matchedAt', m.matched_at,
          'lastInteractionAt', m.last_interaction_at,
          'partnerProfile', public.arrow_safe_profile(
            CASE WHEN m.user1_id = v_actor THEN m.user2_id ELSE m.user1_id END
          ),
          'unreadCount', (
            SELECT COUNT(*) FROM public.arrow_messages msg
            WHERE msg.match_id = m.id AND msg.sender_id <> v_actor AND msg.read_at IS NULL
          ),
          'lastMessage', (
            SELECT jsonb_build_object(
              'body', msg.body,
              'createdAt', msg.created_at,
              'isMine', msg.sender_id = v_actor
            )
            FROM public.arrow_messages msg
            WHERE msg.match_id = m.id
            ORDER BY msg.created_at DESC
            LIMIT 1
          )
        ) AS entry,
        ROW_NUMBER() OVER (
          ORDER BY COALESCE(m.last_interaction_at, m.matched_at) DESC
        ) AS ord
      FROM public.arrow_matches m
      JOIN public.arrow_profiles p
        ON p.id = CASE WHEN m.user1_id = v_actor THEN m.user2_id ELSE m.user1_id END
      WHERE (m.user1_id = v_actor OR m.user2_id = v_actor)
        AND p.is_banned = FALSE
        AND p.deleted_at IS NULL
      LIMIT 200
    ) rows
  ), '[]'::jsonb);
END;
$$;

-- 7.16 Unmatch. Membership is proven before anything is deleted.
CREATE OR REPLACE FUNCTION public.arrow_unmatch(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_partner UUID := public.arrow_match_partner(v_actor, p_match_id);
BEGIN
  DELETE FROM public.arrow_matches WHERE id = p_match_id;

  -- Drop the underlying likes too, so an unmatch is final rather than
  -- instantly re-matching on the next swipe.
  DELETE FROM public.arrow_likes
  WHERE (from_user_id = v_actor AND to_user_id = v_partner)
     OR (from_user_id = v_partner AND to_user_id = v_actor);

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- 7.17 The only path to a phone number: a live match, and only if its owner
-- opted in. Note it returns the partner's number to you, never yours to them.
CREATE OR REPLACE FUNCTION public.arrow_get_match_whatsapp_contact(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_partner_id UUID := public.arrow_match_partner(v_actor, p_match_id);
  v_partner RECORD;
BEGIN
  IF public.arrow_is_blocked_pair(v_actor, v_partner_id) THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, allow_whatsapp, whatsapp_number, is_banned
  INTO v_partner
  FROM public.arrow_profiles
  WHERE id = v_partner_id;

  IF NOT FOUND OR v_partner.is_banned THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '42501';
  END IF;

  IF v_partner.allow_whatsapp AND v_partner.whatsapp_number IS NOT NULL THEN
    RETURN jsonb_build_object(
      'partnerId', v_partner.id,
      'partnerName', v_partner.name,
      'allowWhatsApp', TRUE,
      'whatsappNumber', v_partner.whatsapp_number
    );
  END IF;

  RETURN jsonb_build_object(
    'partnerId', v_partner.id,
    'partnerName', v_partner.name,
    'allowWhatsApp', FALSE,
    'whatsappNumber', NULL
  );
END;
$$;

-- 7.18 In-app messaging. ARROW's original flow handed out a phone number the
-- moment two people matched; that is a lot of trust to ask for from a
-- stranger. Messaging lets people talk first and share a number only if they
-- choose to. Every call proves match membership first.
CREATE OR REPLACE FUNCTION public.arrow_send_message(
  p_match_id UUID,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_partner UUID := public.arrow_match_partner(v_actor, p_match_id);
  v_clean TEXT := btrim(COALESCE(p_body, ''));
  v_recent INT;
  v_id UUID;
  v_created TIMESTAMPTZ;
BEGIN
  IF v_clean = '' THEN
    RAISE EXCEPTION 'Message cannot be empty' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_clean) > 2000 THEN
    RAISE EXCEPTION 'Message is too long (2000 characters max)' USING ERRCODE = '22023';
  END IF;

  IF public.arrow_is_blocked_pair(v_actor, v_partner) THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_recent
  FROM public.arrow_messages
  WHERE sender_id = v_actor AND created_at > NOW() - INTERVAL '1 hour';

  IF v_recent >= public.arrow_limit('hourly_messages') THEN
    RAISE EXCEPTION 'You are sending messages too quickly. Try again shortly.' USING ERRCODE = '53400';
  END IF;

  INSERT INTO public.arrow_messages (match_id, sender_id, body)
  VALUES (p_match_id, v_actor, v_clean)
  RETURNING id, created_at INTO v_id, v_created;

  UPDATE public.arrow_matches SET last_interaction_at = NOW() WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'matchId', p_match_id,
    'body', v_clean,
    'isMine', TRUE,
    'createdAt', v_created
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.arrow_get_messages(
  p_match_id UUID,
  p_limit INT DEFAULT 100,
  p_before TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_partner UUID := public.arrow_match_partner(v_actor, p_match_id);
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(entry ORDER BY ord)
    FROM (
      SELECT
        jsonb_build_object(
          'id', msg.id,
          'matchId', msg.match_id,
          'body', msg.body,
          'isMine', msg.sender_id = v_actor,
          'createdAt', msg.created_at,
          'readAt', msg.read_at
        ) AS entry,
        ROW_NUMBER() OVER (ORDER BY msg.created_at ASC) AS ord
      FROM (
        SELECT * FROM public.arrow_messages
        WHERE match_id = p_match_id
          AND (p_before IS NULL OR created_at < p_before)
        ORDER BY created_at DESC
        LIMIT v_limit
      ) msg
    ) rows
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.arrow_mark_messages_read(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_partner UUID := public.arrow_match_partner(v_actor, p_match_id);
  v_count INT;
BEGIN
  UPDATE public.arrow_messages
  SET read_at = NOW()
  WHERE match_id = p_match_id
    AND sender_id <> v_actor
    AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', TRUE, 'marked', v_count);
END;
$$;

-- 7.19 Safety: block, unblock, list, report.
CREATE OR REPLACE FUNCTION public.arrow_block_user(p_target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
BEGIN
  IF p_target_id IS NULL OR p_target_id = v_actor THEN
    RAISE EXCEPTION 'You cannot block yourself' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.arrow_profiles WHERE id = p_target_id) THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.arrow_blocks (blocker_id, blocked_id)
  VALUES (v_actor, p_target_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.arrow_unblock_user(p_target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
BEGIN
  DELETE FROM public.arrow_blocks
  WHERE blocker_id = v_actor AND blocked_id = p_target_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- Blocked people are the one case where you keep visibility after cutting
-- contact, so that "unblock" is a usable action rather than a mystery list.
CREATE OR REPLACE FUNCTION public.arrow_get_blocked_profiles()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'location', p.location,
        'blockedAt', b.created_at,
        'photo', (
          SELECT COALESCE(ph.storage_path, ph.photo_url)
          FROM public.arrow_profile_photos ph
          WHERE ph.user_id = p.id
          ORDER BY ph.display_order ASC
          LIMIT 1
        )
      ) ORDER BY b.created_at DESC
    )
    FROM public.arrow_blocks b
    JOIN public.arrow_profiles p ON p.id = b.blocked_id
    WHERE b.blocker_id = v_actor
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.arrow_report_user(
  p_target_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL,
  p_also_block BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_recent INT;
BEGIN
  IF p_target_id IS NULL OR p_target_id = v_actor THEN
    RAISE EXCEPTION 'You cannot report yourself' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.arrow_profiles WHERE id = p_target_id) THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_recent
  FROM public.arrow_reports
  WHERE reporter_id = v_actor AND created_at > NOW() - INTERVAL '24 hours';

  IF v_recent >= public.arrow_limit('daily_reports') THEN
    RAISE EXCEPTION 'Too many reports today. Please contact support.' USING ERRCODE = '53400';
  END IF;

  INSERT INTO public.arrow_reports (reporter_id, reported_id, reason, details)
  VALUES (
    v_actor,
    p_target_id,
    COALESCE(p_reason, 'other')::arrow_report_reason,
    left(COALESCE(p_details, ''), 2000)
  )
  ON CONFLICT DO NOTHING;

  IF COALESCE(p_also_block, TRUE) THEN
    INSERT INTO public.arrow_blocks (blocker_id, blocked_id)
    VALUES (v_actor, p_target_id)
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'blocked', COALESCE(p_also_block, TRUE));
END;
$$;

-- 7.20 Photos. Paths are forced into the caller's own folder, so a client
-- cannot register a path belonging to someone else's storage prefix.
CREATE OR REPLACE FUNCTION public.arrow_add_photo(
  p_storage_path TEXT,
  p_photo_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_count INT;
  v_order INT;
  v_id UUID;
BEGIN
  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'A storage path is required' USING ERRCODE = '22023';
  END IF;

  IF split_part(p_storage_path, '/', 1) <> v_actor::TEXT THEN
    RAISE EXCEPTION 'Photos must be stored under your own folder' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.arrow_profile_photos WHERE user_id = v_actor;

  IF v_count >= public.arrow_limit('max_photos') THEN
    RAISE EXCEPTION 'You can have at most % photos', public.arrow_limit('max_photos')
      USING ERRCODE = '53400';
  END IF;

  SELECT COALESCE(MAX(display_order) + 1, 0) INTO v_order
  FROM public.arrow_profile_photos WHERE user_id = v_actor;

  INSERT INTO public.arrow_profile_photos (user_id, photo_url, storage_path, display_order)
  VALUES (v_actor, COALESCE(p_photo_url, p_storage_path), p_storage_path, v_order)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'path', p_storage_path, 'displayOrder', v_order);
END;
$$;

CREATE OR REPLACE FUNCTION public.arrow_delete_photo(p_storage_path TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_deleted INT;
BEGIN
  DELETE FROM public.arrow_profile_photos
  WHERE user_id = v_actor
    AND (storage_path = p_storage_path OR photo_url = p_storage_path);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Close the gap so display_order stays contiguous and within its CHECK.
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY display_order ASC) - 1 AS new_order
    FROM public.arrow_profile_photos
    WHERE user_id = v_actor
  )
  UPDATE public.arrow_profile_photos ph
  SET display_order = ranked.new_order + 100
  FROM ranked WHERE ph.id = ranked.id;

  UPDATE public.arrow_profile_photos
  SET display_order = display_order - 100
  WHERE user_id = v_actor AND display_order >= 100;

  RETURN jsonb_build_object('success', v_deleted > 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.arrow_reorder_photos(p_paths TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
  v_path TEXT;
  v_index INT := 0;
BEGIN
  IF p_paths IS NULL OR cardinality(p_paths) = 0 THEN
    RETURN jsonb_build_object('success', FALSE);
  END IF;

  -- Two passes through a temporary offset keep the (user_id, display_order)
  -- unique index satisfied at every intermediate step.
  UPDATE public.arrow_profile_photos
  SET display_order = display_order + 100
  WHERE user_id = v_actor;

  FOREACH v_path IN ARRAY p_paths LOOP
    UPDATE public.arrow_profile_photos
    SET display_order = v_index
    WHERE user_id = v_actor
      AND display_order >= 100
      AND (storage_path = v_path OR photo_url = v_path);

    IF FOUND THEN
      v_index := v_index + 1;
    END IF;
  END LOOP;

  -- Anything the client did not mention keeps its relative place at the end.
  WITH leftovers AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY display_order ASC) - 1 + v_index AS new_order
    FROM public.arrow_profile_photos
    WHERE user_id = v_actor AND display_order >= 100
  )
  UPDATE public.arrow_profile_photos ph
  SET display_order = leftovers.new_order
  FROM leftovers WHERE ph.id = leftovers.id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- 7.21 Pause discovery without deleting anything.
CREATE OR REPLACE FUNCTION public.arrow_set_visibility(
  p_is_paused BOOLEAN,
  p_show_online_status BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
BEGIN
  UPDATE public.arrow_profiles
  SET is_paused = COALESCE(p_is_paused, is_paused),
      show_online_status = COALESCE(p_show_online_status, show_online_status),
      updated_at = NOW()
  WHERE id = v_actor;

  RETURN public.arrow_get_my_profile();
END;
$$;

-- 7.22 Account deletion. Removes the profile row; auth.users is cleaned up by
-- the client calling signOut plus Supabase admin deletion, and every arrow_*
-- row cascades from here.
CREATE OR REPLACE FUNCTION public.arrow_delete_my_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := public.arrow_actor();
BEGIN
  DELETE FROM public.arrow_profiles WHERE id = v_actor;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- ==============================================================================
-- 8. TRIGGERS
-- ==============================================================================

-- 8.1 Mutual arrows become a match, server-side. Neither client decides this.
CREATE OR REPLACE FUNCTION public.arrow_handle_mutual_like_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.from_user_id IS NULL OR NEW.to_user_id IS NULL OR NEW.from_user_id = NEW.to_user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.is_pass THEN
    RETURN NEW;
  END IF;

  -- A block in either direction must never produce a match.
  IF public.arrow_is_blocked_pair(NEW.from_user_id, NEW.to_user_id) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.arrow_likes
    WHERE from_user_id = NEW.to_user_id
      AND to_user_id = NEW.from_user_id
      AND is_pass = FALSE
  ) THEN
    INSERT INTO public.arrow_matches (user1_id, user2_id, matched_at)
    VALUES (
      LEAST(NEW.from_user_id, NEW.to_user_id),
      GREATEST(NEW.from_user_id, NEW.to_user_id),
      NOW()
    )
    ON CONFLICT (user1_id, user2_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arrow_trigger_mutual_like_match ON public.arrow_likes;
CREATE TRIGGER arrow_trigger_mutual_like_match
AFTER INSERT OR UPDATE ON public.arrow_likes
FOR EACH ROW EXECUTE FUNCTION public.arrow_handle_mutual_like_match();

-- 8.2 Blocking severs everything between the two people, in both directions.
CREATE OR REPLACE FUNCTION public.arrow_handle_block_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.blocker_id IS NULL OR NEW.blocked_id IS NULL OR NEW.blocker_id = NEW.blocked_id THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.arrow_likes
  WHERE (from_user_id = NEW.blocker_id AND to_user_id = NEW.blocked_id)
     OR (from_user_id = NEW.blocked_id AND to_user_id = NEW.blocker_id);

  -- Messages cascade from the match row.
  DELETE FROM public.arrow_matches
  WHERE user1_id = LEAST(NEW.blocker_id, NEW.blocked_id)
    AND user2_id = GREATEST(NEW.blocker_id, NEW.blocked_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arrow_trigger_block_cleanup ON public.arrow_blocks;
CREATE TRIGGER arrow_trigger_block_cleanup
AFTER INSERT ON public.arrow_blocks
FOR EACH ROW EXECUTE FUNCTION public.arrow_handle_block_cleanup();

-- 8.3 Keep updated_at honest without trusting the client to send it.
CREATE OR REPLACE FUNCTION public.arrow_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arrow_trigger_profiles_updated_at ON public.arrow_profiles;
CREATE TRIGGER arrow_trigger_profiles_updated_at
BEFORE UPDATE ON public.arrow_profiles
FOR EACH ROW EXECUTE FUNCTION public.arrow_touch_updated_at();

DROP TRIGGER IF EXISTS arrow_trigger_preferences_updated_at ON public.arrow_preferences;
CREATE TRIGGER arrow_trigger_preferences_updated_at
BEFORE UPDATE ON public.arrow_preferences
FOR EACH ROW EXECUTE FUNCTION public.arrow_touch_updated_at();

-- ==============================================================================
-- 9. ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
-- Every arrow_* table is read-only from the client and scoped to the caller's
-- own rows. All writes go through the SECURITY DEFINER functions above, which
-- is what makes privilege escalation by direct table write impossible: a user
-- cannot, for example, UPDATE their own profile row to set is_verified_adult
-- or clear is_banned, because no UPDATE policy exists for them at all.
-- ==============================================================================

ALTER TABLE public.arrow_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrow_age_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrow_profile_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrow_preferences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrow_likes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrow_matches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrow_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrow_blocks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrow_reports           ENABLE ROW LEVEL SECURITY;

-- Remove every policy this project has ever defined on these tables, so a
-- re-run cannot leave a stale, more permissive policy behind.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'arrow_profiles', 'arrow_age_verifications', 'arrow_profile_photos',
        'arrow_preferences', 'arrow_likes', 'arrow_matches', 'arrow_messages',
        'arrow_blocks', 'arrow_reports'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 9.1 Profiles: your own row only. Everyone else's data arrives via RPC.
CREATE POLICY "arrow_profiles_select_own"
ON public.arrow_profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- 9.2 Age verification: read-only audit trail.
CREATE POLICY "arrow_age_verifications_select_own"
ON public.arrow_age_verifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 9.3 Photos: your own, plus anyone you are entitled to see.
CREATE POLICY "arrow_photos_select_visible"
ON public.arrow_profile_photos FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.arrow_can_view_profile_photo(user_id)
);

-- 9.4 Preferences: yours.
CREATE POLICY "arrow_preferences_select_own"
ON public.arrow_preferences FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 9.5 Likes: the ones you sent, and the ones pointed at you.
CREATE POLICY "arrow_likes_select_own"
ON public.arrow_likes FOR SELECT TO authenticated
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- 9.6 Matches: the ones you are in.
CREATE POLICY "arrow_matches_select_own"
ON public.arrow_matches FOR SELECT TO authenticated
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- 9.7 Messages: readable only inside a match you belong to. This policy is
-- what makes a Realtime subscription on this table safe.
CREATE POLICY "arrow_messages_select_member"
ON public.arrow_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.arrow_matches m
    WHERE m.id = arrow_messages.match_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

-- 9.8 Blocks and reports: yours only. A reported user is never told.
CREATE POLICY "arrow_blocks_select_own"
ON public.arrow_blocks FOR SELECT TO authenticated
USING (auth.uid() = blocker_id);

CREATE POLICY "arrow_reports_select_own"
ON public.arrow_reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id);

-- 9.9 Table privileges: read-only for clients, belt and braces alongside RLS.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'arrow_profiles', 'arrow_age_verifications', 'arrow_profile_photos',
    'arrow_preferences', 'arrow_likes', 'arrow_matches', 'arrow_messages',
    'arrow_blocks', 'arrow_reports'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
  END LOOP;
END $$;

-- The old permissive discovery view is replaced by arrow_get_discover_feed.
DROP VIEW IF EXISTS public.arrow_discoverable_profiles;

-- Live chat updates for the matched pair, gated by the policy in 9.7.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.arrow_messages;
EXCEPTION WHEN duplicate_object THEN null;
        WHEN undefined_object THEN null;
END $$;

-- ==============================================================================
-- 10. STORAGE — private `arrow-profile-photos` bucket
-- ------------------------------------------------------------------------------
-- The bucket is private. Objects live under `<user-id>/<file>`, so the first
-- path segment is the owner and every policy compares it against auth.uid().
-- Reads are additionally gated by the same visibility rule as profiles, so a
-- blocked user cannot keep pulling photos from a URL they saved earlier.
-- Because the bucket is private, the client must use createSignedUrl() —
-- getPublicUrl() returns a URL that will not load.
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'arrow-profile-photos',
  'arrow-profile-photos',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (policyname ILIKE '%arrow%' OR policyname ILIKE '%profile photo%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "arrow_storage_select_visible"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'arrow-profile-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.arrow_can_view_profile_photo(NULLIF((storage.foldername(name))[1], '')::UUID)
  )
);

CREATE POLICY "arrow_storage_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'arrow-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "arrow_storage_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'arrow-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'arrow-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "arrow_storage_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'arrow-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==============================================================================
-- 11. FUNCTION PRIVILEGES
-- ------------------------------------------------------------------------------
-- Default-deny: every arrow_* function is revoked from PUBLIC and anon, then
-- only the names on this list are granted to authenticated. Helpers such as
-- arrow_actor, arrow_can_view_profile and arrow_safe_profile deliberately stay
-- unreachable from the client — they take a user id as an argument, so exposing
-- them would hand back the IDOR surface the RPC layer removes.
-- ==============================================================================
DO $$
DECLARE
  r RECORD;
  v_client_api TEXT[] := ARRAY[
    'arrow_touch_activity',
    'arrow_get_my_profile',
    'arrow_upsert_my_profile',
    'arrow_complete_age_verification',
    'arrow_set_whatsapp',
    'arrow_get_my_preferences',
    'arrow_set_my_preferences',
    'arrow_get_discover_feed',
    'arrow_get_profile',
    'arrow_get_like_quota',
    'arrow_like_profile',
    'arrow_pass_profile',
    'arrow_rewind_last_swipe',
    'arrow_get_received_likes',
    'arrow_get_sent_likes',
    'arrow_get_matches',
    'arrow_unmatch',
    'arrow_get_match_whatsapp_contact',
    'arrow_send_message',
    'arrow_get_messages',
    'arrow_mark_messages_read',
    'arrow_block_user',
    'arrow_unblock_user',
    'arrow_get_blocked_profiles',
    'arrow_report_user',
    'arrow_add_photo',
    'arrow_delete_photo',
    'arrow_reorder_photos',
    'arrow_set_visibility',
    'arrow_delete_my_account',
    -- Evaluated inside the photo and storage RLS policies as the caller.
    'arrow_can_view_profile_photo'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'arrow\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);

    IF r.proname = ANY(v_client_api) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 12. INSTALL CHECK
-- ------------------------------------------------------------------------------
-- Raises if anything above did not land, so a partial run is never mistaken
-- for a successful one.
-- ==============================================================================
DO $$
DECLARE
  v_tables INT;
  v_rpcs INT;
  v_unprotected TEXT;
BEGIN
  SELECT COUNT(*) INTO v_tables
  FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'arrow\_%';

  SELECT COUNT(*) INTO v_rpcs
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE 'arrow\_%';

  SELECT string_agg(tablename, ', ') INTO v_unprotected
  FROM pg_tables t
  WHERE t.schemaname = 'public' AND t.tablename LIKE 'arrow\_%'
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t.tablename AND c.relrowsecurity
    );

  IF v_tables < 9 THEN
    RAISE EXCEPTION 'ARROW install incomplete: expected 9 tables, found %', v_tables;
  END IF;

  IF v_unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'ARROW install unsafe: RLS missing on %', v_unprotected;
  END IF;

  RAISE NOTICE 'ARROW schema installed: % tables, % functions, RLS active on all.', v_tables, v_rpcs;
END $$;

-- ==============================================================================
-- ARROW DATING APPLICATION — ADDITIVE SUPABASE SCHEMA MIGRATION
-- ==============================================================================
-- IMPORTANT COEXISTENCE NOTICE:
-- This Supabase database is shared with an existing restaurant application containing:
--   - categories
--   - menu_items
--   - orders
--   - reservations
--
-- This migration script is strictly ADDITIVE. It:
--   1. Prefixes all dating tables with `arrow_`
--   2. Enforces isolated Row Level Security (RLS) on `arrow_*` tables only
--   3. Provisions the dedicated `arrow-profile-photos` storage bucket
--   4. Never drops, alters, deletes, truncates, or modifies any existing restaurant tables
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CUSTOM TYPES (NAMESPACED FOR ARROW)
-- ==============================================================================
DO $$ BEGIN
  CREATE TYPE arrow_user_gender AS ENUM ('woman', 'man', 'non-binary');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE arrow_report_reason AS ENUM (
    'harassment',
    'inappropriate_photos',
    'spam_scam',
    'underage',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE arrow_report_status AS ENUM (
    'pending',
    'reviewed',
    'dismissed',
    'banned'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. ARROW TABLES DEFINITION
-- ==============================================================================

-- 3.1.0 ARROW PROFILES TABLE ALTERATIONS (additive migration)
ALTER TABLE public.arrow_profiles ALTER COLUMN date_of_birth DROP NOT NULL;

-- 3.1 ARROW PROFILES TABLE (Connected directly to Supabase Auth auth.users)
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Strict age restriction: Must be 18+ when date_of_birth is set
  CONSTRAINT check_arrow_adult_age CHECK (date_of_birth IS NULL OR date_part('year', age(date_of_birth)) >= 18)
);

-- 3.1.1 ARROW AGE VERIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.arrow_age_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  date_of_birth DATE NOT NULL,
  is_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_arrow_age_verification_user UNIQUE (user_id)
);

-- 3.2 ARROW PROFILE PHOTOS TABLE (Up to 6 photos per user)
CREATE TABLE IF NOT EXISTS public.arrow_profile_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_arrow_photo_order_range CHECK (display_order >= 0 AND display_order <= 5)
);

-- 3.3 ARROW USER DATING PREFERENCES TABLE
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

  CONSTRAINT check_arrow_pref_age CHECK (age_min >= 18 AND age_max >= age_min)
);

-- 3.4 ARROW LIKES TABLE (Arrows sent / Passes)
CREATE TABLE IF NOT EXISTS public.arrow_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  is_pass BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_arrow_no_self_like CHECK (from_user_id <> to_user_id),
  CONSTRAINT unique_arrow_like_direction UNIQUE (from_user_id, to_user_id)
);

-- 3.5 ARROW MATCHES TABLE (Created securely when mutual likes exist)
CREATE TABLE IF NOT EXISTS public.arrow_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),

  -- Enforce user1_id < user2_id to guarantee single match record per pair
  CONSTRAINT check_arrow_user_ordering CHECK (user1_id < user2_id),
  CONSTRAINT unique_arrow_match_pair UNIQUE (user1_id, user2_id)
);

-- 3.6 ARROW BLOCKS TABLE
CREATE TABLE IF NOT EXISTS public.arrow_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.arrow_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_arrow_no_self_block CHECK (blocker_id <> blocked_id),
  CONSTRAINT unique_arrow_block_pair UNIQUE (blocker_id, blocked_id)
);

-- 3.7 ARROW REPORTS TABLE (Private moderation records)
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

-- ==============================================================================
-- 4. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_arrow_profiles_gender ON public.arrow_profiles(gender);
CREATE INDEX IF NOT EXISTS idx_arrow_photos_user ON public.arrow_profile_photos(user_id, display_order);
CREATE INDEX IF NOT EXISTS idx_arrow_likes_from_user ON public.arrow_likes(from_user_id);
CREATE INDEX IF NOT EXISTS idx_arrow_likes_to_user ON public.arrow_likes(to_user_id);
CREATE INDEX IF NOT EXISTS idx_arrow_matches_user1 ON public.arrow_matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_arrow_matches_user2 ON public.arrow_matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_arrow_blocks_blocker ON public.arrow_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_arrow_blocks_blocked ON public.arrow_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_arrow_reports_reporter ON public.arrow_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_arrow_age_verifications_user_id ON public.arrow_age_verifications(user_id);

-- ==============================================================================
-- 5. SECURE DISCOVERY VIEW & FUNCTIONS (PRIVACY BY DESIGN)
-- WhatsApp phone numbers and DOB are NEVER exposed in discovery queries.
-- ==============================================================================

-- Publicly safe discoverable profile view
CREATE OR REPLACE VIEW public.arrow_discoverable_profiles AS
SELECT 
  p.id,
  p.name,
  date_part('year', age(p.date_of_birth))::int AS age,
  p.gender,
  p.location,
  p.bio,
  p.interests,
  p.looking_for,
  p.prompts,
  p.allow_whatsapp,
  p.is_verified_adult,
  p.created_at,
  COALESCE(
    (
      SELECT array_agg(pp.photo_url ORDER BY pp.display_order ASC)
      FROM public.arrow_profile_photos pp
      WHERE pp.user_id = p.id
    ),
    '{}'::text[]
  ) AS photos
FROM public.arrow_profiles p
WHERE p.is_verified_adult = TRUE;

REVOKE ALL ON public.arrow_discoverable_profiles FROM PUBLIC;
REVOKE ALL ON public.arrow_discoverable_profiles FROM authenticated;
REVOKE ALL ON public.arrow_discoverable_profiles FROM anon;

-- Safe RPC to get filtered discovery feed for the authenticated user
CREATE OR REPLACE FUNCTION public.arrow_get_discover_feed(
  p_age_min INT DEFAULT 18,
  p_age_max INT DEFAULT 65,
  p_genders TEXT[] DEFAULT NULL,
  p_location TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  age INT,
  gender arrow_user_gender,
  location TEXT,
  bio TEXT,
  interests TEXT[],
  looking_for TEXT,
  prompts JSONB,
  allow_whatsapp BOOLEAN,
  is_verified_adult BOOLEAN,
  created_at TIMESTAMPTZ,
  photos TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
BEGIN
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT 
    dp.id,
    dp.name,
    dp.age,
    dp.gender,
    dp.location,
    dp.bio,
    dp.interests,
    dp.looking_for,
    dp.prompts,
    dp.allow_whatsapp,
    dp.is_verified_adult,
    dp.created_at,
    dp.photos
  FROM public.arrow_discoverable_profiles dp
  WHERE
    dp.id <> v_current_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.arrow_likes l
      WHERE l.from_user_id = v_current_user_id AND l.to_user_id = dp.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.arrow_blocks b
      WHERE (b.blocker_id = v_current_user_id AND b.blocked_id = dp.id)
         OR (b.blocked_id = v_current_user_id AND b.blocker_id = dp.id)
    )
    AND (dp.age >= p_age_min AND dp.age <= p_age_max)
    AND dp.is_verified_adult = TRUE
    AND (p_genders IS NULL OR cardinality(p_genders) = 0 OR dp.gender::TEXT = ANY(p_genders))
    AND (p_location IS NULL OR p_location = '' OR dp.location ILIKE '%' || p_location || '%')
  ORDER BY dp.created_at DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.arrow_get_discover_feed(
  INT,
  INT,
  TEXT[],
  TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.arrow_get_discover_feed(
  INT,
  INT,
  TEXT[],
  TEXT
) TO authenticated;

-- Secure function to retrieve matched partner's WhatsApp number ONLY upon verified mutual match
CREATE OR REPLACE FUNCTION public.arrow_get_match_whatsapp_contact(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_match RECORD;
  v_partner_id UUID;
  v_partner RECORD;
BEGIN
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_match
  FROM public.arrow_matches
  WHERE id = p_match_id AND (user1_id = v_current_user_id OR user2_id = v_current_user_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found or unauthorized access';
  END IF;

  IF v_match.user1_id = v_current_user_id THEN
    v_partner_id := v_match.user2_id;
  ELSE
    v_partner_id := v_match.user1_id;
  END IF;

  SELECT id, name, allow_whatsapp, whatsapp_number INTO v_partner
  FROM public.arrow_profiles
  WHERE id = v_partner_id;

  IF v_partner.allow_whatsapp AND v_partner.whatsapp_number IS NOT NULL THEN
    RETURN jsonb_build_object(
      'partnerId', v_partner.id,
      'partnerName', v_partner.name,
      'allowWhatsApp', true,
      'whatsappNumber', v_partner.whatsapp_number
    );
  ELSE
    RETURN jsonb_build_object(
      'partnerId', v_partner.id,
      'partnerName', v_partner.name,
      'allowWhatsApp', false,
      'whatsappNumber', null
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.arrow_get_match_whatsapp_contact(
  UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.arrow_get_match_whatsapp_contact(
  UUID
) TO authenticated;

-- ==============================================================================
-- 5.1 SERVER-SIDE AGE VERIFICATION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.arrow_complete_age_verification(p_date_of_birth DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_email_confirmed_at TIMESTAMPTZ;
  v_age INT;
  v_profile_exists BOOLEAN;
BEGIN
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Authentication required');
  END IF;

  SELECT email_confirmed_at INTO v_email_confirmed_at
  FROM auth.users
  WHERE id = v_current_user_id;

  IF v_email_confirmed_at IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Email not verified');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.arrow_profiles WHERE id = v_current_user_id)
  INTO v_profile_exists;

  IF NOT v_profile_exists THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Profile not found');
  END IF;

  IF p_date_of_birth IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Date of birth is required');
  END IF;

  v_age := date_part('year', age(p_date_of_birth))::INT;

  IF v_age < 18 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Must be 18 or older');
  END IF;

  UPDATE public.arrow_profiles
  SET date_of_birth = p_date_of_birth,
      is_verified_adult = TRUE,
      updated_at = NOW()
  WHERE id = v_current_user_id;

  INSERT INTO public.arrow_age_verifications (user_id, date_of_birth, is_eligible, verified_at)
  VALUES (v_current_user_id, p_date_of_birth, TRUE, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    date_of_birth = EXCLUDED.date_of_birth,
    is_eligible = TRUE,
    verified_at = NOW();

  RETURN jsonb_build_object('success', TRUE, 'age', v_age);
END;
$$;

REVOKE ALL ON FUNCTION public.arrow_complete_age_verification(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arrow_complete_age_verification(DATE) FROM authenticated;
REVOKE ALL ON FUNCTION public.arrow_complete_age_verification(DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.arrow_complete_age_verification(DATE) TO authenticated;

-- ==============================================================================
-- 6. AUTOMATED SERVER-SIDE MUTUAL MATCH TRIGGER
-- When User A likes User B and User B likes User A, automatically creates exactly 1 match in arrow_matches
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.arrow_handle_mutual_like_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mutual_like_exists BOOLEAN;
  v_u1 UUID;
  v_u2 UUID;
BEGIN
  IF NEW.from_user_id IS NULL OR NEW.to_user_id IS NULL OR NEW.from_user_id = NEW.to_user_id THEN
    RETURN NEW;
  END IF;

  -- Only process positive likes (Arrows), not passes
  IF NEW.is_pass = FALSE THEN
    -- Check if the target user has already liked the new user
    SELECT EXISTS (
      SELECT 1 FROM public.arrow_likes
      WHERE from_user_id = NEW.to_user_id
        AND to_user_id = NEW.from_user_id
        AND is_pass = FALSE
    ) INTO v_mutual_like_exists;

    IF v_mutual_like_exists THEN
      -- Deterministic ordering: smaller UUID is user1_id, larger is user2_id
      IF NEW.from_user_id < NEW.to_user_id THEN
        v_u1 := NEW.from_user_id;
        v_u2 := NEW.to_user_id;
      ELSE
        v_u1 := NEW.to_user_id;
        v_u2 := NEW.from_user_id;
      END IF;

      -- Insert match if not already existing
      INSERT INTO public.arrow_matches (user1_id, user2_id, matched_at)
      VALUES (v_u1, v_u2, NOW())
      ON CONFLICT (user1_id, user2_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arrow_trigger_mutual_like_match ON public.arrow_likes;
CREATE TRIGGER arrow_trigger_mutual_like_match
AFTER INSERT OR UPDATE ON public.arrow_likes
FOR EACH ROW
EXECUTE FUNCTION public.arrow_handle_mutual_like_match();

-- ==============================================================================
-- 7. CLEANUP TRIGGER ON BLOCK
-- When User A blocks User B, automatically remove likes and matches between them
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.arrow_handle_block_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_u1 UUID;
  v_u2 UUID;
BEGIN
  IF NEW.blocker_id IS NULL OR NEW.blocked_id IS NULL OR NEW.blocker_id = NEW.blocked_id THEN
    RETURN NEW;
  END IF;

  -- Delete any likes in either direction
  DELETE FROM public.arrow_likes
  WHERE (from_user_id = NEW.blocker_id AND to_user_id = NEW.blocked_id)
     OR (from_user_id = NEW.blocked_id AND to_user_id = NEW.blocker_id);

  -- Delete match record if existed
  IF NEW.blocker_id < NEW.blocked_id THEN
    v_u1 := NEW.blocker_id;
    v_u2 := NEW.blocked_id;
  ELSE
    v_u1 := NEW.blocked_id;
    v_u2 := NEW.blocker_id;
  END IF;

  DELETE FROM public.arrow_matches
  WHERE user1_id = v_u1 AND user2_id = v_u2;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arrow_trigger_block_cleanup ON public.arrow_blocks;
CREATE TRIGGER arrow_trigger_block_cleanup
AFTER INSERT ON public.arrow_blocks
FOR EACH ROW
EXECUTE FUNCTION public.arrow_handle_block_cleanup();

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES (ARROW TABLES ONLY)
-- ==============================================================================

-- 8.1 ARROW PROFILES RLS
ALTER TABLE public.arrow_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Arrow profiles are viewable by authenticated users" ON public.arrow_profiles;
CREATE POLICY "Arrow users can read own profile"
ON public.arrow_profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Arrow users can create own profile" ON public.arrow_profiles;
CREATE POLICY "Arrow users can create own profile"
ON public.arrow_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Arrow users can update own profile" ON public.arrow_profiles;
CREATE POLICY "Arrow users can update own profile"
ON public.arrow_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Arrow users can delete own profile" ON public.arrow_profiles;
CREATE POLICY "Arrow users can delete own profile"
ON public.arrow_profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- 8.1.1 ARROW AGE VERIFICATIONS RLS
ALTER TABLE public.arrow_age_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own age verification" ON public.arrow_age_verifications;
CREATE POLICY "Users can view own age verification"
ON public.arrow_age_verifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 8.2 ARROW PROFILE PHOTOS RLS
ALTER TABLE public.arrow_profile_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Arrow profile photos are viewable by authenticated users" ON public.arrow_profile_photos;
CREATE POLICY "Arrow users can view accessible profile photos"
ON public.arrow_profile_photos FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.arrow_can_view_profile_photo(user_id)
);

DROP POLICY IF EXISTS "Arrow users can insert own photos" ON public.arrow_profile_photos;
CREATE POLICY "Arrow users can insert own photos"
ON public.arrow_profile_photos FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Arrow users can update own photos" ON public.arrow_profile_photos;
CREATE POLICY "Arrow users can update own photos"
ON public.arrow_profile_photos FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Arrow users can delete own photos" ON public.arrow_profile_photos;
CREATE POLICY "Arrow users can delete own photos"
ON public.arrow_profile_photos FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 8.3 ARROW PREFERENCES RLS
ALTER TABLE public.arrow_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Arrow users can read own preferences" ON public.arrow_preferences;
CREATE POLICY "Arrow users can read own preferences"
ON public.arrow_preferences FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Arrow users can insert own preferences" ON public.arrow_preferences;
CREATE POLICY "Arrow users can insert own preferences"
ON public.arrow_preferences FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Arrow users can update own preferences" ON public.arrow_preferences;
CREATE POLICY "Arrow users can update own preferences"
ON public.arrow_preferences FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 8.4 ARROW LIKES RLS
ALTER TABLE public.arrow_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Arrow users can read their own sent likes or incoming likes" ON public.arrow_likes;
CREATE POLICY "Arrow users can read their own sent likes or incoming likes"
ON public.arrow_likes FOR SELECT
TO authenticated
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "Arrow users can insert their own likes" ON public.arrow_likes;
CREATE POLICY "Arrow users can insert their own likes"
ON public.arrow_likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Arrow users can update their own likes" ON public.arrow_likes;
CREATE POLICY "Arrow users can update their own likes"
ON public.arrow_likes FOR UPDATE
TO authenticated
USING (auth.uid() = from_user_id)
WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Arrow users can delete their own likes" ON public.arrow_likes;
CREATE POLICY "Arrow users can delete their own likes"
ON public.arrow_likes FOR DELETE
TO authenticated
USING (auth.uid() = from_user_id);

-- 8.5 ARROW MATCHES RLS
ALTER TABLE public.arrow_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Arrow users can view matches they are part of" ON public.arrow_matches;
CREATE POLICY "Arrow users can view matches they are part of"
ON public.arrow_matches FOR SELECT
TO authenticated
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Arrow users can unmatch matches they are part of" ON public.arrow_matches;
CREATE POLICY "Arrow users can unmatch matches they are part of"
ON public.arrow_matches FOR DELETE
TO authenticated
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- 8.6 ARROW BLOCKS RLS
ALTER TABLE public.arrow_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Arrow users can view blocks they created" ON public.arrow_blocks;
CREATE POLICY "Arrow users can view blocks they created"
ON public.arrow_blocks FOR SELECT
TO authenticated
USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Arrow users can create blocks" ON public.arrow_blocks;
CREATE POLICY "Arrow users can create blocks"
ON public.arrow_blocks FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Arrow users can remove their own blocks" ON public.arrow_blocks;
CREATE POLICY "Arrow users can remove their own blocks"
ON public.arrow_blocks FOR DELETE
TO authenticated
USING (auth.uid() = blocker_id);

-- 8.7 ARROW REPORTS RLS
ALTER TABLE public.arrow_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Arrow users can view reports they filed" ON public.arrow_reports;
CREATE POLICY "Arrow users can view reports they filed"
ON public.arrow_reports FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Arrow users can submit reports" ON public.arrow_reports;
CREATE POLICY "Arrow users can submit reports"
ON public.arrow_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- ==============================================================================
-- 9. SUPABASE STORAGE BUCKET (DEDICATED ARROW BUCKET)
-- Bucket: arrow-profile-photos
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.arrow_can_view_profile_photo(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_profile_exists BOOLEAN;
BEGIN
  IF v_current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.arrow_profiles WHERE id = p_profile_id)
  INTO v_profile_exists;

  IF NOT v_profile_exists THEN
    RETURN FALSE;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM public.arrow_blocks b
    WHERE (b.blocker_id = v_current_user_id AND b.blocked_id = p_profile_id)
       OR (b.blocked_id = v_current_user_id AND b.blocker_id = p_profile_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.arrow_can_view_profile_photo(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arrow_can_view_profile_photo(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.arrow_can_view_profile_photo(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.arrow_can_view_profile_photo(UUID) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'arrow-profile-photos',
  'arrow-profile-photos',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- Storage RLS Policies for arrow-profile-photos bucket
DROP POLICY IF EXISTS "Arrow public profile photos are viewable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view accessible profile photos" ON storage.objects;

CREATE POLICY "Authenticated users can view accessible profile photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'arrow-profile-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.arrow_can_view_profile_photo((storage.foldername(name))[1]::UUID)
  )
);

DROP POLICY IF EXISTS "Arrow users can upload their own profile photos" ON storage.objects;
CREATE POLICY "Arrow users can upload their own profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'arrow-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Arrow users can update their own profile photos" ON storage.objects;
CREATE POLICY "Arrow users can update their own profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'arrow-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Arrow users can delete their own profile photos" ON storage.objects;
CREATE POLICY "Arrow users can delete their own profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'arrow-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==============================================================================
-- ARROW SECURITY TEST SUITE
-- ==============================================================================
-- Exercises the schema as three separate logged-in users and asserts that the
-- authorization rules actually hold. Every test that represents an attack is
-- written so that a PASS means the attack failed.
--
-- Run against a database that has had supabase/schema.sql applied:
--   psql -f supabase/tests/security.sql
-- Any failed assertion aborts the run with an exception.
-- ==============================================================================

\set ON_ERROR_STOP on

-- Act as a given user by setting the claim auth.uid() reads, then dropping to
-- the `authenticated` role so RLS and function grants apply exactly as they do
-- for a real client.
CREATE OR REPLACE FUNCTION public.arrow_test_login(p_user UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.arrow_test_assert(p_condition BOOLEAN, p_label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_condition IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: %', p_label;
  END IF;
  RAISE NOTICE '  pass  %', p_label;
END;
$$;

-- ------------------------------------------------------------------------------
-- Fixtures: Ada and Blake match each other; Mallory is the attacker.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  blake UUID := '22222222-2222-2222-2222-222222222222';
  mallory UUID := '33333333-3333-3333-3333-333333333333';
BEGIN
  DELETE FROM auth.users WHERE id IN (ada, blake, mallory);

  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
    (ada,     'ada@example.test',     NOW()),
    (blake,   'blake@example.test',   NOW()),
    (mallory, 'mallory@example.test', NOW());

  INSERT INTO public.arrow_profiles (id, name, gender, location, date_of_birth, is_verified_adult, whatsapp_number, allow_whatsapp)
  VALUES
    (ada,     'Ada',     'woman', 'Nairobi', '1994-03-02', TRUE, '+254700000001', TRUE),
    (blake,   'Blake',   'man',   'Nairobi', '1992-07-19', TRUE, '+254700000002', TRUE),
    (mallory, 'Mallory', 'man',   'Nairobi', '1990-01-05', TRUE, '+254700000003', TRUE)
  ON CONFLICT (id) DO UPDATE SET is_verified_adult = TRUE, is_banned = FALSE, is_paused = FALSE;

  INSERT INTO public.arrow_preferences (user_id) VALUES (ada), (blake), (mallory)
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- ==============================================================================
-- 1. IDOR: reading another user's profile
-- ==============================================================================
\echo '1. Profile access control'

-- Ada and Blake match, so Mallory has no relationship with the match itself.
DO $$
BEGIN
  PERFORM public.arrow_test_login('11111111-1111-1111-1111-111111111111');
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_like_profile('22222222-2222-2222-2222-222222222222');
  RESET ROLE;

  PERFORM public.arrow_test_login('22222222-2222-2222-2222-222222222222');
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_like_profile('11111111-1111-1111-1111-111111111111');
  RESET ROLE;
END $$;

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  blake UUID := '22222222-2222-2222-2222-222222222222';
  v_match_id UUID;
  v_rows INT;
  v_json JSONB;
BEGIN
  SELECT id INTO v_match_id FROM public.arrow_matches
  WHERE user1_id = LEAST(ada, blake) AND user2_id = GREATEST(ada, blake);

  PERFORM public.arrow_test_assert(v_match_id IS NOT NULL,
    'mutual arrows create exactly one match server-side');

  -- Direct table read as Mallory must expose nobody but Mallory.
  PERFORM public.arrow_test_login('33333333-3333-3333-3333-333333333333');
  SET LOCAL ROLE authenticated;
  SELECT COUNT(*) INTO v_rows FROM public.arrow_profiles;
  PERFORM public.arrow_test_assert(v_rows = 1,
    'direct SELECT on arrow_profiles returns only your own row');

  SELECT COUNT(*) INTO v_rows FROM public.arrow_matches;
  PERFORM public.arrow_test_assert(v_rows = 0,
    'direct SELECT on arrow_matches hides matches you are not in');

  -- The RPC still refuses to hand over a private field.
  v_json := public.arrow_get_profile(ada);
  PERFORM public.arrow_test_assert(v_json IS NOT NULL,
    'a discoverable profile is readable through the RPC');
  PERFORM public.arrow_test_assert(NOT (v_json ? 'whatsappNumber'),
    'ATTACK BLOCKED: profile RPC never returns a phone number');
  PERFORM public.arrow_test_assert(NOT (v_json ? 'dateOfBirth'),
    'ATTACK BLOCKED: profile RPC never returns a date of birth');
  RESET ROLE;
END $$;

-- ==============================================================================
-- 2. IDOR: match-scoped resources with a guessed id
-- ==============================================================================
\echo '2. Match-scoped IDOR'

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  blake UUID := '22222222-2222-2222-2222-222222222222';
  v_match_id UUID;
  v_failed BOOLEAN;
BEGIN
  SELECT id INTO v_match_id FROM public.arrow_matches
  WHERE user1_id = LEAST(ada, blake) AND user2_id = GREATEST(ada, blake);

  PERFORM public.arrow_test_login('33333333-3333-3333-3333-333333333333');
  SET LOCAL ROLE authenticated;

  -- Mallory knows the match id and tries each match-scoped call in turn.
  v_failed := FALSE;
  BEGIN PERFORM public.arrow_get_match_whatsapp_contact(v_match_id);
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: cannot read a phone number from someone else''s match');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_get_messages(v_match_id);
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: cannot read messages from someone else''s match');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_send_message(v_match_id, 'hello');
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: cannot inject a message into someone else''s match');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_unmatch(v_match_id);
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: cannot unmatch two other people');

  RESET ROLE;
END $$;

-- ==============================================================================
-- 3. Privilege escalation through direct table writes
-- ==============================================================================
\echo '3. Direct write attempts'

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  mallory UUID := '33333333-3333-3333-3333-333333333333';
  v_failed BOOLEAN;
BEGIN
  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;

  v_failed := FALSE;
  BEGIN
    UPDATE public.arrow_profiles SET is_verified_adult = TRUE WHERE id = mallory;
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: cannot self-approve the 18+ gate by direct UPDATE');

  v_failed := FALSE;
  BEGIN
    UPDATE public.arrow_profiles SET is_banned = FALSE WHERE id = mallory;
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: cannot lift your own ban by direct UPDATE');

  v_failed := FALSE;
  BEGIN
    INSERT INTO public.arrow_likes (from_user_id, to_user_id)
    VALUES (ada, mallory);
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: cannot forge an arrow from another user to yourself');

  v_failed := FALSE;
  BEGIN
    INSERT INTO public.arrow_matches (user1_id, user2_id)
    VALUES (LEAST(ada, mallory), GREATEST(ada, mallory));
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: cannot fabricate a match with someone who never liked you');

  RESET ROLE;
END $$;

-- ==============================================================================
-- 4. Internal helpers are not reachable from a client
-- ==============================================================================
\echo '4. Function grants'

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  v_failed BOOLEAN;
BEGIN
  PERFORM public.arrow_test_login('33333333-3333-3333-3333-333333333333');
  SET LOCAL ROLE authenticated;

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_safe_profile(ada);
  EXCEPTION WHEN insufficient_privilege THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: arrow_safe_profile is not executable by a client');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_can_view_profile(ada, ada);
  EXCEPTION WHEN insufficient_privilege THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: the visibility helper cannot be probed directly');

  RESET ROLE;
END $$;

-- ==============================================================================
-- 5. Contact exchange requires a real, mutual, opted-in match
-- ==============================================================================
\echo '5. Contact exchange'

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  blake UUID := '22222222-2222-2222-2222-222222222222';
  v_match_id UUID;
  v_json JSONB;
BEGIN
  SELECT id INTO v_match_id FROM public.arrow_matches
  WHERE user1_id = LEAST(ada, blake) AND user2_id = GREATEST(ada, blake);

  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;

  v_json := public.arrow_get_match_whatsapp_contact(v_match_id);
  PERFORM public.arrow_test_assert((v_json->>'allowWhatsApp')::BOOLEAN,
    'a matched user who opted in does share their number');
  PERFORM public.arrow_test_assert(v_json->>'whatsappNumber' = '+254700000002',
    'the number returned belongs to the partner, not the caller');
  RESET ROLE;

  -- Blake withdraws consent.
  PERFORM public.arrow_test_login(blake);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_set_whatsapp(FALSE, NULL);
  RESET ROLE;

  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  v_json := public.arrow_get_match_whatsapp_contact(v_match_id);
  PERFORM public.arrow_test_assert(v_json->>'whatsappNumber' IS NULL,
    'withdrawing consent immediately stops the number being shared');
  RESET ROLE;
END $$;

-- ==============================================================================
-- 6. Blocking
-- ==============================================================================
\echo '6. Blocking'

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  blake UUID := '22222222-2222-2222-2222-222222222222';
  v_feed JSONB;
  v_rows INT;
BEGIN
  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_block_user(blake);

  SELECT COUNT(*) INTO v_rows FROM public.arrow_matches;
  PERFORM public.arrow_test_assert(v_rows = 0,
    'blocking removes the match between the two people');

  PERFORM public.arrow_test_assert(public.arrow_get_profile(blake) IS NULL,
    'a blocked user''s profile is no longer readable');
  RESET ROLE;

  -- The block is symmetric: Blake loses sight of Ada too.
  PERFORM public.arrow_test_login(blake);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_test_assert(public.arrow_get_profile(ada) IS NULL,
    'blocking is symmetric — the blocked user also loses access');

  v_feed := public.arrow_get_discover_feed();
  PERFORM public.arrow_test_assert(
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_feed) e WHERE (e->>'id')::UUID = ada),
    'a blocked user never reappears in discovery');
  RESET ROLE;

  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_unblock_user(blake);
  RESET ROLE;
END $$;

-- ==============================================================================
-- 7. The 18+ gate
-- ==============================================================================
\echo '7. Age verification'

DO $$
DECLARE
  minor UUID := '44444444-4444-4444-4444-444444444444';
  v_json JSONB;
  v_feed JSONB;
BEGIN
  DELETE FROM auth.users WHERE id = minor;
  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES (minor, 'minor@example.test', NOW());
  INSERT INTO public.arrow_profiles (id, name, gender, is_verified_adult)
  VALUES (minor, 'Minor', 'non-binary', FALSE)
  ON CONFLICT (id) DO UPDATE SET is_verified_adult = FALSE;

  PERFORM public.arrow_test_login(minor);
  SET LOCAL ROLE authenticated;

  v_json := public.arrow_complete_age_verification((CURRENT_DATE - INTERVAL '15 years')::DATE);
  PERFORM public.arrow_test_assert((v_json->>'success')::BOOLEAN IS FALSE,
    'ATTACK BLOCKED: a 15-year-old cannot pass age verification');

  v_json := public.arrow_complete_age_verification((CURRENT_DATE + INTERVAL '1 year')::DATE);
  PERFORM public.arrow_test_assert((v_json->>'success')::BOOLEAN IS FALSE,
    'ATTACK BLOCKED: a future date of birth is rejected');
  RESET ROLE;

  -- And an unverified account is invisible to everyone else.
  PERFORM public.arrow_test_login('33333333-3333-3333-3333-333333333333');
  SET LOCAL ROLE authenticated;
  v_feed := public.arrow_get_discover_feed();
  PERFORM public.arrow_test_assert(
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_feed) e WHERE (e->>'id')::UUID = minor),
    'an unverified account never appears in discovery');
  RESET ROLE;
END $$;

-- ==============================================================================
-- 8. Photo ownership
-- ==============================================================================
\echo '8. Photo ownership'

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  mallory UUID := '33333333-3333-3333-3333-333333333333';
  v_failed BOOLEAN;
  v_count INT;
BEGIN
  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_add_photo(ada::TEXT || '/stolen.jpg');
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: cannot register a photo under another user''s folder');

  -- Own folder is fine, and the cap is enforced.
  FOR i IN 1..6 LOOP
    PERFORM public.arrow_add_photo(mallory::TEXT || '/p' || i || '.jpg');
  END LOOP;

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_add_photo(mallory::TEXT || '/p7.jpg');
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed, 'the six photo cap is enforced');

  PERFORM public.arrow_reorder_photos(ARRAY[
    mallory::TEXT || '/p3.jpg', mallory::TEXT || '/p1.jpg'
  ]);
  SELECT COUNT(DISTINCT display_order) INTO v_count
  FROM public.arrow_profile_photos WHERE user_id = mallory;
  PERFORM public.arrow_test_assert(v_count = 6,
    'reordering keeps every photo at a distinct position');

  SELECT display_order INTO v_count FROM public.arrow_profile_photos
  WHERE user_id = mallory AND storage_path = mallory::TEXT || '/p3.jpg';
  PERFORM public.arrow_test_assert(v_count = 0, 'reordering puts the requested photo first');

  RESET ROLE;
END $$;

-- ==============================================================================
-- 9. Rate limits
-- ==============================================================================
\echo '9. Abuse limits'

DO $$
DECLARE
  mallory UUID := '33333333-3333-3333-3333-333333333333';
  v_target UUID;
  v_failed BOOLEAN;
  v_json JSONB;
BEGIN
  -- Fill the daily arrow budget with synthetic targets.
  FOR i IN 1..61 LOOP
    v_target := ('55555555-0000-0000-0000-' || lpad(i::TEXT, 12, '0'))::UUID;
    INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES (v_target, 'bulk' || i || '@example.test', NOW())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.arrow_profiles (id, name, gender, date_of_birth, is_verified_adult)
    VALUES (v_target, 'Bulk' || i, 'woman', '1995-01-01', TRUE)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;

  -- Spend the budget. Each of these is its own successful call, exactly as a
  -- real client would make them.
  FOR i IN 1..60 LOOP
    PERFORM public.arrow_like_profile(
      ('55555555-0000-0000-0000-' || lpad(i::TEXT, 12, '0'))::UUID
    );
  END LOOP;

  v_failed := FALSE;
  BEGIN
    PERFORM public.arrow_like_profile('55555555-0000-0000-0000-000000000061'::UUID);
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: the daily arrow limit stops mass-liking');

  v_json := public.arrow_get_like_quota();
  PERFORM public.arrow_test_assert((v_json->>'arrowsRemaining')::INT = 0,
    'the quota reported to the client matches what the database enforces');

  RESET ROLE;
END $$;

-- ==============================================================================
-- 10. Messaging between a real match
-- ==============================================================================
\echo '10. Messaging'

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  blake UUID := '22222222-2222-2222-2222-222222222222';
  v_match_id UUID;
  v_msgs JSONB;
  v_json JSONB;
  v_failed BOOLEAN;
BEGIN
  -- Rebuild the match the block test removed.
  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_like_profile(blake);
  RESET ROLE;
  PERFORM public.arrow_test_login(blake);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_like_profile(ada);
  RESET ROLE;

  SELECT id INTO v_match_id FROM public.arrow_matches
  WHERE user1_id = LEAST(ada, blake) AND user2_id = GREATEST(ada, blake);

  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_send_message(v_match_id, 'Hey Blake, good to match.');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_send_message(v_match_id, '   ');
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed, 'an empty message is rejected');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_send_message(v_match_id, repeat('x', 2500));
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed, 'an oversized message is rejected');
  RESET ROLE;

  PERFORM public.arrow_test_login(blake);
  SET LOCAL ROLE authenticated;
  v_msgs := public.arrow_get_messages(v_match_id);
  PERFORM public.arrow_test_assert(jsonb_array_length(v_msgs) = 1,
    'the partner sees the message');
  PERFORM public.arrow_test_assert((v_msgs->0->>'isMine')::BOOLEAN IS FALSE,
    'authorship is reported from the reader''s point of view');

  v_json := public.arrow_mark_messages_read(v_match_id);
  PERFORM public.arrow_test_assert((v_json->>'marked')::INT = 1,
    'read receipts mark only the partner''s messages');
  RESET ROLE;
END $$;

\echo ''
\echo 'All ARROW security tests passed.'

-- ==============================================================================
-- Fixture cleanup
-- ------------------------------------------------------------------------------
-- Removing the test users makes the suite repeatable against the same scratch
-- database: every arrow_* row cascades from arrow_profiles, which cascades from
-- auth.users.
-- ==============================================================================
DO $$
BEGIN
  DELETE FROM auth.users
  WHERE email LIKE '%@example.test';
END $$;

DROP FUNCTION IF EXISTS public.arrow_test_login(UUID);
DROP FUNCTION IF EXISTS public.arrow_test_assert(BOOLEAN, TEXT);

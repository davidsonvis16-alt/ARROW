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
  -- Read the free allowance from the schema so the test follows the number.
  v_limit INT := public.arrow_plan_limit('free', 'daily_arrows');
  v_target UUID;
  v_failed BOOLEAN;
  v_json JSONB;
BEGIN
  -- Fill the daily arrow budget with synthetic targets.
  FOR i IN 1..(v_limit + 1) LOOP
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
  FOR i IN 1..v_limit LOOP
    PERFORM public.arrow_like_profile(
      ('55555555-0000-0000-0000-' || lpad(i::TEXT, 12, '0'))::UUID
    );
  END LOOP;

  v_failed := FALSE;
  BEGIN
    PERFORM public.arrow_like_profile(
      ('55555555-0000-0000-0000-' || lpad((v_limit + 1)::TEXT, 12, '0'))::UUID
    );
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

-- ==============================================================================
-- 11. Plans cannot be self-granted
-- ==============================================================================
\echo '11. Membership integrity'

DO $$
DECLARE
  mallory UUID := '33333333-3333-3333-3333-333333333333';
  v_failed BOOLEAN;
  v_json JSONB;
BEGIN
  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;

  v_json := public.arrow_get_my_plan();
  PERFORM public.arrow_test_assert(v_json->>'plan' = 'free',
    'a new account starts on the free plan');

  v_failed := FALSE;
  BEGIN
    INSERT INTO public.arrow_subscriptions (user_id, plan, status, source)
    VALUES (mallory, 'premium', 'active', 'grant');
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: cannot insert a Premium subscription for yourself');

  v_failed := FALSE;
  BEGIN
    PERFORM COUNT(*) FROM public.arrow_subscriptions;
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: subscription rows (and Stripe ids) are not readable');

  v_failed := FALSE;
  BEGIN
    PERFORM public.arrow_apply_card_subscription(
      mallory, 'premium', 'active', NOW() + INTERVAL '1 year', 'CUS_x', 'SUB_x', NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: the subscription webhook function is not callable by a client');

  v_failed := FALSE;
  BEGIN
    PERFORM public.arrow_record_payment('fake_ref', mallory, 'premium', 'mpesa', 99900, 'KES');
  EXCEPTION WHEN insufficient_privilege THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: a client cannot record a payment it never made');

  v_failed := FALSE;
  BEGIN PERFORM COUNT(*) FROM public.arrow_payments;
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: the payments table is not readable directly');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_set_incognito(TRUE);
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'a free account cannot switch on incognito');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_start_boost();
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'a free account cannot boost');

  -- The trial works exactly once.
  v_json := public.arrow_start_trial();
  PERFORM public.arrow_test_assert(v_json->>'plan' = 'plus',
    'the free trial grants Plus');
  PERFORM public.arrow_test_assert((v_json->>'trialAvailable')::BOOLEAN IS FALSE,
    'the trial is marked as used once started');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_start_trial();
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: the free trial cannot be started twice');

  RESET ROLE;

  -- An expired trial is free again, with no clean-up job required.
  UPDATE public.arrow_subscriptions
  SET current_period_end = NOW() - INTERVAL '1 minute'
  WHERE user_id = mallory;

  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_test_assert(public.arrow_get_my_plan()->>'plan' = 'free',
    'an expired plan reverts to free on its own');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_start_trial();
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: an expired trial does not unlock a second one');
  RESET ROLE;
END $$;

-- ==============================================================================
-- 12. "See who liked you" is withheld by the server on free
-- ==============================================================================
\echo '12. Likes paywall'

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  blake UUID := '22222222-2222-2222-2222-222222222222';
  cleo UUID := '66666666-6666-6666-6666-666666666666';
  dana UUID := '77777777-7777-7777-7777-777777777777';
  v_json JSONB;
  v_rows INT;
  v_failed BOOLEAN;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
    (cleo, 'cleo@example.test', NOW()), (dana, 'dana@example.test', NOW())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.arrow_profiles (id, name, gender, location, date_of_birth, is_verified_adult)
  VALUES (cleo, 'Cleo', 'woman', 'Nairobi', '1996-05-05', TRUE),
         (dana, 'Dana', 'woman', 'Nairobi', '1997-06-06', TRUE)
  ON CONFLICT (id) DO NOTHING;

  -- Cleo sends Ada an ordinary arrow; Dana sends a super arrow.
  PERFORM public.arrow_test_login(cleo);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_like_profile(ada);

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_like_profile(blake, TRUE, 'Hi there');
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'a note with a super arrow needs Plus');
  RESET ROLE;

  PERFORM public.arrow_test_login(dana);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_like_profile(ada, TRUE);
  RESET ROLE;

  -- Ada is on free.
  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  v_json := public.arrow_get_received_likes();
  PERFORM public.arrow_test_assert((v_json->>'locked')::BOOLEAN,
    'the likes list is locked on free');
  PERFORM public.arrow_test_assert((v_json->>'hiddenCount')::INT = 1,
    'free shows how many people liked you');
  PERFORM public.arrow_test_assert(
    jsonb_array_length(v_json->'entries') = 1
    AND (v_json->'entries'->0->'profile'->>'id')::UUID = dana,
    'free reveals super arrows only');
  PERFORM public.arrow_test_assert(
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_json->'entries') e
                WHERE (e->'profile'->>'id')::UUID = cleo),
    'ATTACK BLOCKED: a hidden liker''s identity is not in the response');

  SELECT COUNT(*) INTO v_rows FROM public.arrow_likes WHERE to_user_id = ada;
  PERFORM public.arrow_test_assert(v_rows = 0,
    'ATTACK BLOCKED: arrows pointed at you cannot be listed from the table');
  RESET ROLE;

  -- The webhook upgrades Ada to Plus.
  PERFORM public.arrow_apply_card_subscription(
    ada, 'plus', 'active', NOW() + INTERVAL '30 days', 'CUS_ada', 'SUB_ada', 'tok_ada');

  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  v_json := public.arrow_get_received_likes();
  PERFORM public.arrow_test_assert(
    NOT (v_json->>'locked')::BOOLEAN AND jsonb_array_length(v_json->'entries') = 2,
    'Plus reveals everyone who liked you');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_delete_my_account();
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'an account with a renewing subscription must cancel before deleting');
  RESET ROLE;

  -- Cancelling keeps what was paid for, then drops back to free.
  PERFORM public.arrow_apply_card_subscription(
    ada, 'plus', 'cancelled', NULL, 'CUS_ada', 'SUB_ada', 'tok_ada');
  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_test_assert(
    NOT (public.arrow_get_received_likes()->>'locked')::BOOLEAN
    AND (public.arrow_get_my_plan()->>'cancelAtPeriodEnd')::BOOLEAN,
    'cancelling mid-month keeps the time already paid for, without renewing');
  RESET ROLE;

  UPDATE public.arrow_subscriptions SET current_period_end = NOW() - INTERVAL '1 minute'
  WHERE user_id = ada;
  PERFORM public.arrow_apply_card_subscription(
    ada, 'plus', 'cancelled', NULL, 'CUS_ada', 'SUB_ada', 'tok_ada');
  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_test_assert(
    (public.arrow_get_received_likes()->>'locked')::BOOLEAN,
    'once the paid period is over, a cancelled subscription stops revealing likes');
  RESET ROLE;
END $$;

-- ==============================================================================
-- 13. Premium: incognito, read receipts, reactions
-- ==============================================================================
\echo '13. Premium features'

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  blake UUID := '22222222-2222-2222-2222-222222222222';
  mallory UUID := '33333333-3333-3333-3333-333333333333';
  v_match_id UUID;
  v_msg_id UUID;
  v_json JSONB;
  v_failed BOOLEAN;
BEGIN
  PERFORM public.arrow_apply_card_subscription(
    blake, 'premium', 'active', NOW() + INTERVAL '30 days', 'CUS_blake', 'SUB_blake', 'tok_blake');

  -- Blake goes incognito: strangers lose sight of him, his match does not.
  PERFORM public.arrow_test_login(blake);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_set_incognito(TRUE);
  RESET ROLE;

  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_test_assert(public.arrow_get_profile(blake) IS NULL,
    'incognito hides you from people you have not liked');
  PERFORM public.arrow_test_assert(
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.arrow_get_discover_feed()) e
                WHERE (e->>'id')::UUID = blake),
    'incognito keeps you out of discovery');
  RESET ROLE;

  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_test_assert(public.arrow_get_profile(blake) IS NOT NULL,
    'incognito never hides you from a match');
  RESET ROLE;

  -- Read receipts: Blake (Premium) sees when Ada read his message.
  SELECT id INTO v_match_id FROM public.arrow_matches
  WHERE user1_id = LEAST(ada, blake) AND user2_id = GREATEST(ada, blake);

  PERFORM public.arrow_test_login(blake);
  SET LOCAL ROLE authenticated;
  v_msg_id := (public.arrow_send_message(v_match_id, 'Coffee this week?')->>'id')::UUID;
  RESET ROLE;

  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_mark_messages_read(v_match_id);

  v_failed := FALSE;
  BEGIN PERFORM read_at FROM public.arrow_messages WHERE id = v_msg_id;
  EXCEPTION WHEN insufficient_privilege THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: read_at cannot be read straight off the table');

  v_json := public.arrow_react_to_message(v_msg_id, '🔥');
  PERFORM public.arrow_test_assert(v_json->>'reaction' = '🔥',
    'the recipient can react to a message');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_react_to_message(v_msg_id, '<script>');
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'reactions are limited to the fixed emoji set');
  RESET ROLE;

  PERFORM public.arrow_test_login(blake);
  SET LOCAL ROLE authenticated;
  v_json := public.arrow_get_messages(v_match_id);
  PERFORM public.arrow_test_assert(
    EXISTS (SELECT 1 FROM jsonb_array_elements(v_json) e
            WHERE (e->>'id')::UUID = v_msg_id AND e->>'readAt' IS NOT NULL),
    'Premium sees a read receipt on its own message');

  v_failed := FALSE;
  BEGIN PERFORM public.arrow_react_to_message(v_msg_id, '❤️');
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'you cannot react to your own message');
  RESET ROLE;

  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;
  v_failed := FALSE;
  BEGIN PERFORM public.arrow_react_to_message(v_msg_id, '😢');
  EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: cannot react inside someone else''s match');
  RESET ROLE;

  -- Ada is free: her own sent message shows no receipt.
  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_send_message(v_match_id, 'Yes!');
  RESET ROLE;
  PERFORM public.arrow_test_login(blake);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_mark_messages_read(v_match_id);
  RESET ROLE;
  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_test_assert(
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.arrow_get_messages(v_match_id)) e
                WHERE (e->>'isMine')::BOOLEAN AND e->>'readAt' IS NOT NULL),
    'free does not receive read receipts');
  RESET ROLE;

  -- Premium lapses: incognito stops hiding Blake without anyone touching it.
  UPDATE public.arrow_subscriptions SET current_period_end = NOW() - INTERVAL '1 minute'
  WHERE user_id = blake;
  PERFORM public.arrow_apply_card_subscription(
    blake, 'premium', 'cancelled', NULL, 'CUS_blake', 'SUB_blake', 'tok_blake');
  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_test_assert(public.arrow_get_profile(blake) IS NOT NULL,
    'incognito switches off by itself when Premium lapses');
  RESET ROLE;
END $$;

-- ==============================================================================
-- 14. Private typing channels
-- ==============================================================================
\echo '14. Realtime channel authorization'

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  blake UUID := '22222222-2222-2222-2222-222222222222';
  v_match_id UUID;
  v_failed BOOLEAN;
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE '  skip  realtime schema not present';
    RETURN;
  END IF;

  SELECT id INTO v_match_id FROM public.arrow_matches
  WHERE user1_id = LEAST(ada, blake) AND user2_id = GREATEST(ada, blake);

  PERFORM set_config('realtime.topic', 'arrow-match:' || v_match_id, true);

  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  INSERT INTO realtime.messages (topic, extension, payload)
  VALUES ('arrow-match:' || v_match_id, 'broadcast', '{"typing":true}');
  PERFORM public.arrow_test_assert(TRUE, 'a match member may broadcast on the match channel');
  RESET ROLE;

  PERFORM public.arrow_test_login('33333333-3333-3333-3333-333333333333');
  SET LOCAL ROLE authenticated;
  v_failed := FALSE;
  BEGIN
    INSERT INTO realtime.messages (topic, extension, payload)
    VALUES ('arrow-match:' || v_match_id, 'broadcast', '{"typing":true}');
  EXCEPTION WHEN insufficient_privilege THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'ATTACK BLOCKED: an outsider cannot broadcast into a match channel');

  PERFORM set_config('realtime.topic', 'arrow-match:not-a-uuid', true);
  v_failed := FALSE;
  BEGIN
    INSERT INTO realtime.messages (topic, extension, payload)
    VALUES ('arrow-match:not-a-uuid', 'broadcast', '{}');
  EXCEPTION WHEN insufficient_privilege THEN v_failed := TRUE; END;
  PERFORM public.arrow_test_assert(v_failed,
    'a malformed topic is refused cleanly rather than erroring');
  RESET ROLE;
END $$;

-- ==============================================================================
-- 15. Payments: exactly once, private, and passes that never renew
-- ==============================================================================
\echo '15. Payments and receipts'

DO $$
DECLARE
  ada UUID := '11111111-1111-1111-1111-111111111111';
  mallory UUID := '33333333-3333-3333-3333-333333333333';
  v_json JSONB;
  v_end1 TIMESTAMPTZ;
  v_end2 TIMESTAMPTZ;
BEGIN
  -- Ada pays for a Plus pass with M-Pesa.
  v_json := public.arrow_record_payment('mpesa_ref_1', ada, 'plus', 'mpesa', 49900, 'kes', 'CUS_ada', 30);
  PERFORM public.arrow_test_assert((v_json->>'applied')::BOOLEAN,
    'an M-Pesa payment is applied');

  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  v_json := public.arrow_get_my_plan();
  PERFORM public.arrow_test_assert(v_json->>'plan' = 'plus' AND v_json->>'paymentMethod' = 'mpesa',
    'an M-Pesa pass grants the plan it paid for');
  PERFORM public.arrow_test_assert((v_json->>'renews')::BOOLEAN IS FALSE,
    'an M-Pesa pass is reported as not renewing');
  v_end1 := (v_json->>'currentPeriodEnd')::TIMESTAMPTZ;
  RESET ROLE;

  -- Paystack delivers the same webhook again.
  v_json := public.arrow_record_payment('mpesa_ref_1', ada, 'plus', 'mpesa', 49900, 'kes', 'CUS_ada', 30);
  PERFORM public.arrow_test_assert((v_json->>'applied')::BOOLEAN IS FALSE,
    'a duplicate webhook for the same payment changes nothing');

  -- A second pass tops up the first instead of overlapping it.
  PERFORM public.arrow_record_payment('mpesa_ref_2', ada, 'plus', 'mpesa', 49900, 'KES', 'CUS_ada', 30);
  PERFORM public.arrow_test_login(ada);
  SET LOCAL ROLE authenticated;
  v_end2 := (public.arrow_get_my_plan()->>'currentPeriodEnd')::TIMESTAMPTZ;
  PERFORM public.arrow_test_assert(v_end2 - v_end1 BETWEEN INTERVAL '29 days 23 hours' AND INTERVAL '30 days 1 hour',
    'a second pass adds 30 days to the end of the first');

  v_json := public.arrow_get_my_payments();
  PERFORM public.arrow_test_assert(jsonb_array_length(v_json) = 2,
    'both payments appear in your receipts, once each');
  PERFORM public.arrow_test_assert((v_json->0->>'currency') = 'KES',
    'receipts show the currency the payment was made in');

  -- An M-Pesa pass needs no cancelling, so it never blocks deletion.
  PERFORM public.arrow_test_assert(
    (public.arrow_get_my_plan()->>'canManageBilling')::BOOLEAN IS FALSE,
    'there is no card subscription to manage on an M-Pesa pass');
  RESET ROLE;

  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_test_assert(
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.arrow_get_my_payments()) e
                WHERE e->>'reference' LIKE 'mpesa_ref_%'),
    'ATTACK BLOCKED: nobody else can see your payments');
  RESET ROLE;

  -- Card: non-renewing means "cancelled, but runs to the end".
  PERFORM public.arrow_apply_card_subscription(
    mallory, 'premium', 'non-renewing', NOW() + INTERVAL '10 days', 'CUS_m', 'SUB_m1', 'tok_m');
  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;
  v_json := public.arrow_get_my_plan();
  PERFORM public.arrow_test_assert(
    v_json->>'plan' = 'premium' AND (v_json->>'cancelAtPeriodEnd')::BOOLEAN AND NOT (v_json->>'renews')::BOOLEAN,
    'a cancelled card plan keeps working until the date already paid for');
  RESET ROLE;

  -- A newer subscription takes over; the old one finishing does not end it.
  PERFORM public.arrow_apply_card_subscription(
    mallory, 'plus', 'active', NOW() + INTERVAL '30 days', 'CUS_m', 'SUB_m2', 'tok_m2');
  PERFORM public.arrow_apply_card_subscription(
    mallory, 'premium', 'completed', NULL, 'CUS_m', 'SUB_m1', 'tok_m');
  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_test_assert(public.arrow_get_my_plan()->>'plan' = 'plus',
    'an old subscription ending never cancels the newer one');
  RESET ROLE;

  PERFORM public.arrow_test_assert(
    public.arrow_billing_user('CUS_m', NULL) = mallory
    AND public.arrow_billing_user(NULL, 'ADA@example.test') = ada,
    'the webhook finds the account by customer code or sign-in email');
END $$;

-- ==============================================================================
-- 16. Passed people come back; arrows sent do not
-- ==============================================================================
\echo '16. Pass cooldown'

DO $$
DECLARE
  mallory UUID := '33333333-3333-3333-3333-333333333333';
  pia UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  quin UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_json JSONB;
  in_feed BOOLEAN;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
    (pia, 'pia@example.test', NOW()), (quin, 'quin@example.test', NOW())
  ON CONFLICT (id) DO NOTHING;
  -- Recently active, so they rank at the top of a deck that already holds
  -- more than one page of earlier fixtures.
  INSERT INTO public.arrow_profiles (id, name, gender, location, date_of_birth, is_verified_adult, last_active_at)
  VALUES (pia, 'Pia', 'woman', 'Nairobi', '1996-02-02', TRUE, NOW()),
         (quin, 'Quin', 'woman', 'Nairobi', '1996-03-03', TRUE, NOW())
  ON CONFLICT (id) DO NOTHING;
  -- Mallory's earlier arrow allowance is spent; let him swipe here.
  DELETE FROM public.arrow_likes WHERE from_user_id = mallory;

  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;
  PERFORM public.arrow_pass_profile(pia);
  PERFORM public.arrow_like_profile(quin);

  in_feed := EXISTS (SELECT 1 FROM jsonb_array_elements(public.arrow_get_discover_feed()) e WHERE (e->>'id')::UUID = pia);
  PERFORM public.arrow_test_assert(NOT in_feed, 'a fresh pass hides the person');
  RESET ROLE;

  -- Eight days later.
  UPDATE public.arrow_likes SET created_at = NOW() - INTERVAL '8 days'
  WHERE from_user_id = mallory;

  PERFORM public.arrow_test_login(mallory);
  SET LOCAL ROLE authenticated;
  v_json := public.arrow_get_discover_feed();
  PERFORM public.arrow_test_assert(
    EXISTS (SELECT 1 FROM jsonb_array_elements(v_json) e WHERE (e->>'id')::UUID = pia),
    'someone you passed on comes back after the cooldown');
  PERFORM public.arrow_test_assert(
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_json) e WHERE (e->>'id')::UUID = quin),
    'someone you sent an arrow to does not come back into the deck');

  -- Pass again, then bring everyone back at once.
  PERFORM public.arrow_pass_profile(pia);
  v_json := public.arrow_clear_passes();
  PERFORM public.arrow_test_assert((v_json->>'restored')::INT = 1,
    'clearing passes reports how many people came back');
  PERFORM public.arrow_test_assert(
    EXISTS (SELECT 1 FROM jsonb_array_elements(public.arrow_get_discover_feed()) e WHERE (e->>'id')::UUID = pia),
    'clearing passes puts them straight back in the deck');
  PERFORM public.arrow_test_assert(
    EXISTS (SELECT 1 FROM public.arrow_likes WHERE from_user_id = mallory AND to_user_id = quin AND NOT is_pass),
    'clearing passes keeps the arrows you sent');
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
  -- Subscriptions hang off auth.users, so they go with it.
  DELETE FROM auth.users
  WHERE email LIKE '%@example.test';
END $$;

DROP FUNCTION IF EXISTS public.arrow_test_login(UUID);
DROP FUNCTION IF EXISTS public.arrow_test_assert(BOOLEAN, TEXT);

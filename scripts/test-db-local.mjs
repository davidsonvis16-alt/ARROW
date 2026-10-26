// Runs the schema and the security suite in PGlite — real Postgres compiled to
// WebAssembly — so the tests need no database server. The Supabase-managed
// schemas (auth, storage, realtime) are replaced by minimal stand-ins that
// behave the same way for what the schema uses.
//
//   npm run test:db:local            install, re-install, test, re-test
//
// --twice checks that the schema is idempotent and the suite repeatable.
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';

const [schemaPath = 'supabase/schema.sql', testsPath = 'supabase/tests/security.sql'] = process.argv
  .slice(2)
  .filter((a) => !a.startsWith('--'));
const twice = process.argv.includes('--twice');

const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } });

const notices = [];


const stubs = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
$$;
CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claim.role', true)
$$;

CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
CREATE TABLE storage.buckets (
  id TEXT PRIMARY KEY, name TEXT, public BOOLEAN,
  file_size_limit BIGINT, allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT, name TEXT
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

CREATE SCHEMA realtime;
GRANT USAGE ON SCHEMA realtime TO authenticated;
CREATE TABLE realtime.messages (
  id BIGSERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  extension TEXT NOT NULL,
  payload JSONB,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON realtime.messages TO authenticated;
GRANT USAGE ON SEQUENCE realtime.messages_id_seq TO authenticated;
CREATE FUNCTION realtime.topic() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT current_setting('realtime.topic', true)
$$;

CREATE PUBLICATION supabase_realtime;
`;

// psql meta-commands are not SQL; \\echo lines become notices so the output
// still reads like a psql run.
function stripMeta(sql) {
  return sql
    .split('\n')
    .map((line) => {
      const m = line.match(/^\\echo\s+'(.*)'\s*$/);
      if (m) return m[1] ? `DO $$ BEGIN RAISE NOTICE '%', '${m[1].replace(/'/g, "''")}'; END $$;` : '';
      return line.startsWith('\\') ? '' : line;
    })
    .join('\n');
}

async function runFile(label, sql) {
  notices.length = 0;
  try {
    await db.exec(sql, { onNotice: (n) => notices.push(n.message) });
  } catch (err) {
    for (const n of notices) console.log(n);
    console.error(`\n✗ ${label} failed: ${err.message}`);
    if (err.where) console.error(`  where: ${err.where}`);
    if (err.position) console.error(`  position: ${err.position}`);
    process.exit(1);
  }
  for (const n of notices) console.log(n);
  console.log(`✓ ${label}`);
}

await db.exec(stubs);
const schema = readFileSync(schemaPath, 'utf8');
await runFile('schema', schema);
if (twice) await runFile('schema (re-run, idempotency)', schema);

if (testsPath) {
  const tests = stripMeta(readFileSync(testsPath, 'utf8'));
  await runFile('security tests', tests);
  if (twice) await runFile('security tests (re-run, repeatability)', tests);
  const passes = notices.filter((n) => n.trimStart().startsWith('pass')).length;
  console.log(`assertions passed in last run: ${passes}`);
}

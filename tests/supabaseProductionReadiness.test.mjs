import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname;

function walk(dir, predicate = () => true) {
  const results = [];

  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git'].includes(entry)) continue;

    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      results.push(...walk(fullPath, predicate));
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

function readRepoFile(path) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

const srcFiles = walk(join(repoRoot, 'src'), (file) => /\.(js|jsx|mjs)$/.test(file));
const frontendSources = srcFiles.map((file) => ({ file: relative(repoRoot, file), source: readFileSync(file, 'utf8') }));

const createClientReferences = frontendSources
  .filter(({ source }) => source.includes('createClient'))
  .map(({ file }) => file);

assert.deepEqual(
  createClientReferences,
  ['src/lib/supabase.js'],
  'the browser app should keep one intended Supabase client factory in src/lib/supabase.js',
);

const supabaseSource = readRepoFile('src/lib/supabase.js');
assert.match(supabaseSource, /VITE_SUPABASE_URL/, 'frontend Supabase URL must use the public Vite variable');
assert.match(supabaseSource, /VITE_SUPABASE_ANON_KEY/, 'frontend Supabase anon key must use the public Vite variable');
assert.match(supabaseSource, /supabase\s*=\s*isSupabaseConfigured[\s\S]*:\s*null/, 'missing Supabase config should keep the client null');
assert.doesNotMatch(supabaseSource, /SUPABASE_SERVICE|SERVICE_ROLE_KEY|serviceRoleKey/, 'frontend Supabase client must not reference service-role credentials');

const forbiddenFrontendSecretReferences = /SUPABASE_SERVICE|SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY|TWILIO_AUTH_TOKEN/;
const frontendSecretHits = frontendSources
  .filter(({ source }) => forbiddenFrontendSecretReferences.test(source))
  .map(({ file }) => file);
assert.deepEqual(frontendSecretHits, [], 'frontend source must not reference server-only secret env vars');

const envFiles = walk(repoRoot, (file) => /(^|\/)\.env(\.|$)/.test(file));
const committedEnvFiles = envFiles.map((file) => relative(repoRoot, file)).filter((file) => file !== '.env.example');
assert.deepEqual(committedEnvFiles, [], 'no committed .env files are allowed except .env.example');
assert.equal(existsSync(join(repoRoot, 'docs/SUPABASE_READINESS_AUDIT.md')), true, 'Supabase readiness audit doc should exist');

const migrationSources = walk(join(repoRoot, 'supabase', 'migrations'), (file) => file.endsWith('.sql'))
  .map((file) => ({ file: relative(repoRoot, file), source: readFileSync(file, 'utf8') }));

const unsafeMigrationHits = migrationSources
  .filter(({ source }) => /disable\s+row\s+level\s+security|using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/i.test(source))
  .map(({ file }) => file);
assert.deepEqual(unsafeMigrationHits, [], 'migrations should not disable RLS or add broad true policies');

console.log('Supabase production-readiness tests passed');

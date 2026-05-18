import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname;

function walk(dir, predicate = () => true) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git'].includes(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) results.push(...walk(full, predicate));
    else if (predicate(full)) results.push(full);
  }
  return results;
}

function readRepoFile(path) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

const helperFiles = [
  'src/lib/properties.js',
  'src/lib/bookings.js',
  'src/lib/cleaningTasks.js',
  'src/lib/maintenanceWorkOrders.js',
  'src/lib/owners.js',
  'src/lib/guests.js',
];

const helperSources = helperFiles.map((file) => ({ file, source: readRepoFile(file) }));
const appContextSource = readRepoFile('src/lib/AppContext.jsx');
const readmeSource = readRepoFile('README.md');
const readinessSource = readRepoFile('docs/SUPABASE_READINESS_AUDIT.md');

const migrationFiles = walk(join(repoRoot, 'supabase', 'migrations'), (file) => file.endsWith('.sql'));
const migrationsJoined = migrationFiles.map((file) => readFileSync(file, 'utf8')).join('\n\n');

// 1) Workspace scoping across helpers + migrations
for (const { file, source } of helperSources) {
  assert.match(source, /\.eq\('workspace_id',\s*\w+\.(workspaceId|workspace_id)\)/, `${file} should scope reads/updates by workspace_id`);
}
for (const table of ['properties', 'bookings', 'cleaning_tasks', 'maintenance_work_orders', 'contacts']) {
  assert.match(migrationsJoined, new RegExp(`${table}[^\\n]*workspace_id|workspace_id[^\\n]*${table}`, 'i'), `migrations should contain workspace_id coverage for ${table}`);
}

// 2) No obvious global reads in helpers
for (const { file, source } of helperSources) {
  const compact = source.replace(/\s+/g, ' ');
  assert.doesNotMatch(compact, /\.from\('[^']+'\)\.select\('\*'\)\.(order|limit)\(/, `${file} should not have immediate unscoped select/order reads`);
}

// 3) Role policy presence in migrations
for (const role of ['workspace_owner', 'property_manager', 'host']) {
  assert.match(migrationsJoined, new RegExp(`'${role}'`), `migrations should include ${role} role coverage`);
}
assert.match(migrationsJoined, /'owner'|'property_owner'/, 'migrations should include owner/property_owner coverage');
assert.match(migrationsJoined, /assigned_cleaner_id\s*=\s*auth\.uid\(\)/, 'migrations should include cleaner assigned-task access checks');
assert.match(migrationsJoined, /assigned_maintenance_id\s*=\s*auth\.uid\(\)/, 'migrations should include maintenance assigned-work-order checks');

// 4) Cross-workspace relationship guards
for (const guard of [
  'property_belongs_to_workspace',
  'workspace_property_belongs_to_workspace',
  'optional_contact_belongs_to_workspace',
  'contact_type',
  'is_active_workspace_member',
]) {
  assert.match(migrationsJoined, new RegExp(guard), `migrations should include ${guard} guard/constraint coverage`);
}

// 5) Sensitive key guard in frontend
const frontendFiles = walk(join(repoRoot, 'src'), (file) => /\.(js|jsx|mjs)$/.test(file));
const forbiddenSecretPattern = /SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|SUPABASE_SECRET|STRIPE_SECRET_KEY|RESEND_API_KEY|TWILIO_AUTH_TOKEN|VITE_.*(SECRET|SERVICE_ROLE)|PRIVATE_/i;
const secretHits = frontendFiles
  .map((file) => ({ file: relative(repoRoot, file), source: readFileSync(file, 'utf8') }))
  .filter(({ source }) => forbiddenSecretPattern.test(source))
  .map(({ file }) => file);
assert.deepEqual(secretHits, [], 'frontend files must not reference backend-only secret keys or service role credentials');

// 6) AppContext client safety
assert.doesNotMatch(appContextSource, /^\s*requireSupabase\(\);\s*$/m, 'AppContext should not call bare requireSupabase() without binding to client first');

// 7) Documentation coverage
const docsCombined = `${readmeSource}\n${readinessSource}`.toLowerCase();
for (const phrase of ['vite_supabase_url', 'vite_supabase_anon_key', 'rls', 'workspace', 'missing', 'properties', 'bookings', 'cleaning', 'maintenance', 'owner', 'guest']) {
  assert.match(docsCombined, new RegExp(phrase), `README/docs should mention ${phrase}`);
}

console.log('RLS role-matrix static verification tests passed');

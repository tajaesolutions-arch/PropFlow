import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  WORKSPACE_FILES_BUCKET,
  buildWorkspaceFilePayload,
  getWorkspaceFilePath,
  normalizeWorkspaceFileType,
  validateWorkspaceUploadFile,
  listWorkspaceFiles,
} from '../src/lib/fileUploads.js';

const repoRoot = new URL('..', import.meta.url).pathname;

const fakeFile = (name, type, size) => ({ name, type, size });

assert.equal(WORKSPACE_FILES_BUCKET, 'workspace-files');
assert.notEqual(WORKSPACE_FILES_BUCKET, 'public');

assert.equal(normalizeWorkspaceFileType('owner_report'), 'report_file');
assert.equal(normalizeWorkspaceFileType('property_document'), 'general_document');

const path = getWorkspaceFilePath({ workspaceId: 'ws_123', entityType: 'property', entityId: '../prop-1', fileName: '../../bad name.pdf', timestamp: 1 });
assert.match(path, /^workspaces\/ws_123\/property\/prop-1\//);
assert.doesNotMatch(path, /\.\./);
assert.match(path, /bad-name\.pdf$/);

const validImage = validateWorkspaceUploadFile(fakeFile('home.jpg', 'image/jpeg', 1024), { fileCategory: 'property_photo' });
assert.equal(validImage.valid, true);

const badCategoryType = validateWorkspaceUploadFile(fakeFile('video.mp4', 'video/mp4', 1024), { fileCategory: 'property_photo' });
assert.equal(badCategoryType.valid, false);

const overSize = validateWorkspaceUploadFile(fakeFile('doc.pdf', 'application/pdf', 26 * 1024 * 1024), { fileCategory: 'general_document' });
assert.equal(overSize.valid, false);

const validVideo = validateWorkspaceUploadFile(fakeFile('repair.mp4', 'video/mp4', 10 * 1024 * 1024), { fileCategory: 'maintenance_video' });
assert.equal(validVideo.valid, true);

const payload = buildWorkspaceFilePayload({
  workspaceId: ' ws_a ',
  propertyId: 'p1',
  fileCategory: 'property_document',
  file_name: '  lease copy.pdf  ',
  notes: '  ',
});
assert.equal(payload.workspace_id, 'ws_a');
assert.equal(payload.file_category, 'general_document');
assert.equal(payload.file_name, 'lease-copy.pdf');
assert.equal(payload.notes, null);
assert.equal(payload.visibility, 'private');

await assert.rejects(() => listWorkspaceFiles({ workspaceId: '' }), /workspace_id is required/);
const safeRows = await listWorkspaceFiles({ supabase: null, workspaceId: 'ws_1' });
assert.deepEqual(safeRows, []);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist'].includes(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) files.push(...walk(full));
    else if (/\.(js|jsx|mjs)$/.test(entry)) files.push(full);
  }
  return files;
}

const frontendFiles = walk(join(repoRoot, 'src'));
const forbiddenPattern = /SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|VITE_.*SERVICE_ROLE|PRIVATE_/i;
const forbiddenHits = frontendFiles
  .map((file) => ({ file: relative(repoRoot, file), source: readFileSync(file, 'utf8') }))
  .filter(({ source }) => forbiddenPattern.test(source))
  .map(({ file }) => file);
assert.deepEqual(forbiddenHits, []);

const migrationBlob = readdirSync(join(repoRoot, 'supabase', 'migrations'))
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(repoRoot, 'supabase', 'migrations', file), 'utf8'))
  .join('\n');
assert.match(migrationBlob, /workspace-files/i);
assert.match(migrationBlob, /storage\.objects/i);

console.log('fileUploads data-access tests passed');

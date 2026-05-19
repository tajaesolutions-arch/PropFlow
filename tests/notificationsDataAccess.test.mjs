import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  archiveNotification,
  buildNotificationPayload,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../src/lib/notifications.js';

const helperSource = readFileSync(new URL('../src/lib/notifications.js', import.meta.url), 'utf8');
const appContextSource = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../supabase/migrations/202605110001_in_app_notifications_hardening.sql', import.meta.url), 'utf8');
const srcSources = [helperSource, appContextSource, readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8')].join('\n');

const missingWorkspace = await listNotifications({});
assert.equal(missingWorkspace.code, 'missing_workspace_id');
assert.deepEqual(missingWorkspace.data, []);

const noEnv = await listNotifications({ workspaceId: 'workspace-1', userId: 'user-1' });
assert.equal(noEnv.notConfigured, true);
assert.equal(noEnv.unreadCount, 0);

const payload = buildNotificationPayload({ title: '  Hello  ', body: '  World  ', event_type: 'unknown_event', status: 'whatever', priority: 'EXTREME', entity_type: '  booking  ', entity_id: ' ', metadata: 'bad' });
assert.equal(payload.title, 'Hello');
assert.equal(payload.body, 'World');
assert.equal(payload.event_type, 'booking_created');
assert.equal(payload.status, 'unread');
assert.equal(payload.priority, 'normal');
assert.equal(payload.entity_type, 'booking');
assert.equal(payload.entity_id, null);
assert.deepEqual(payload.metadata, {});

const markMissing = await markNotificationRead({ workspaceId: 'ws-1', notificationId: '', userId: '' });
assert.equal(markMissing.code, 'missing_notification_identifiers');
const markAllMissing = await markAllNotificationsRead({ workspaceId: 'ws-1' });
assert.equal(markAllMissing.code, 'missing_user_id');
const archiveMissing = await archiveNotification({ workspaceId: 'ws-1', notificationId: null, userId: null });
assert.equal(archiveMissing.code, 'missing_notification_identifiers');

assert.match(helperSource, /\.eq\('workspace_id',\s*w\.workspaceId\)/);
assert.doesNotMatch(srcSources, /SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|SUPABASE_SECRET|VITE_.*(SECRET|SERVICE_ROLE)/i);
assert.match(appContextSource, /markWorkspaceNotificationRead\(/);
assert.match(appContextSource, /updateWorkspaceNotificationPreferences\(/);
assert.match(migrationSource, /create policy notifications_select_authorized/);
assert.match(migrationSource, /create policy notifications_update_own_status/);

console.log('Notifications data-access tests passed');

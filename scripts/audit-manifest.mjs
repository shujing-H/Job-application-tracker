import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../dist/manifest.json', import.meta.url), 'utf8'));
const exactScope = ['https://www.googleapis.com/auth/drive.file'];
const requiredPermissions = ['alarms', 'identity', 'identity.email', 'notifications', 'storage'];
const forbiddenPermissions = ['cookies', 'debugger', 'history', 'tabs', 'webRequest'];

function assert(condition, message) {
  if (!condition) throw new Error(`Manifest audit failed: ${message}`);
}

assert(manifest.manifest_version === 3, 'must be Manifest V3');
assert(JSON.stringify([...manifest.oauth2.scopes].sort()) === JSON.stringify(exactScope), 'OAuth must use only drive.file');
assert(requiredPermissions.every((permission) => manifest.permissions.includes(permission)), 'required permissions are missing');
assert(forbiddenPermissions.every((permission) => !manifest.permissions.includes(permission)), 'a forbidden broad permission is present');
assert(manifest.host_permissions.includes('https://sheets.googleapis.com/*'), 'Sheets API host permission is missing');
assert(!manifest.host_permissions.includes('<all_urls>'), 'broad all-URLs access is forbidden');
assert(typeof manifest.oauth2.client_id === 'string' && manifest.oauth2.client_id.endsWith('.apps.googleusercontent.com'), 'OAuth client ID is malformed');
console.log('Manifest audit passed: MV3, exact drive.file OAuth scope, bounded hosts, and no broad browser permissions.');

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(await readFile(new URL('../dist/manifest.json', import.meta.url), 'utf8'));
const exactScope = ['https://www.googleapis.com/auth/drive.file'];
const requiredPermissions = ['alarms', 'identity', 'identity.email', 'notifications', 'storage'];
const forbiddenPermissions = ['cookies', 'debugger', 'history', 'tabs', 'webRequest'];
const expectedExtensionId = 'fiejecpjihcaiglpahoincdmpdjnmmdc';

function assert(condition, message) {
  if (!condition) throw new Error(`Manifest audit failed: ${message}`);
}

assert(manifest.manifest_version === 3, 'must be Manifest V3');
assert(typeof manifest.key === 'string' && !/\s/.test(manifest.key), 'stable public key is missing or contains whitespace');
const keyHash = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest().subarray(0, 16);
const derivedExtensionId = [...keyHash]
  .map((byte) => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15)))
  .join('');
assert(derivedExtensionId === expectedExtensionId, `public key derives ${derivedExtensionId}, expected ${expectedExtensionId}`);
assert(JSON.stringify([...manifest.oauth2.scopes].sort()) === JSON.stringify(exactScope), 'OAuth must use only drive.file');
assert(requiredPermissions.every((permission) => manifest.permissions.includes(permission)), 'required permissions are missing');
assert(forbiddenPermissions.every((permission) => !manifest.permissions.includes(permission)), 'a forbidden broad permission is present');
assert(manifest.host_permissions.includes('https://sheets.googleapis.com/*'), 'Sheets API host permission is missing');
assert(manifest.host_permissions.includes('https://*.12twenty.com/*'), '12twenty host permission is missing');
assert(!manifest.host_permissions.includes('<all_urls>'), 'broad all-URLs access is forbidden');
assert(typeof manifest.oauth2.client_id === 'string' && manifest.oauth2.client_id.endsWith('.apps.googleusercontent.com'), 'OAuth client ID is malformed');
console.log(`Manifest audit passed: stable ID ${derivedExtensionId}, MV3, exact drive.file OAuth scope, bounded hosts, and no broad browser permissions.`);

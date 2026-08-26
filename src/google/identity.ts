export type GoogleIdentity = { accountId: string; email: string; token: string };
const PLACEHOLDER_CLIENT_ID_PREFIX = '000000000000-';

export function oauthConfigured(): boolean {
  const clientId = chrome.runtime.getManifest().oauth2?.client_id;
  return Boolean(clientId && !clientId.startsWith(PLACEHOLDER_CLIENT_ID_PREFIX));
}

function requireOauthConfiguration(): void {
  if (!oauthConfigured()) {
    throw new Error('Google sign-in needs a one-time OAuth client ID. See the Google OAuth setup guide.');
  }
}

async function profile(): Promise<chrome.identity.ProfileUserInfo> {
  return chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
}

function requireProfile(user: chrome.identity.ProfileUserInfo): { accountId: string; email: string } {
  if (!user.id || !user.email) {
    throw new Error('Sign in to Chrome with the Google account you want to use, then try again.');
  }
  return { accountId: user.id, email: user.email };
}

export async function connectGoogleIdentity(): Promise<GoogleIdentity> {
  requireOauthConfiguration();
  const result = await chrome.identity.getAuthToken({ interactive: true, enableGranularPermissions: true });
  if (!result.token) throw new Error('Google authorization did not return an access token.');
  return { ...requireProfile(await profile()), token: result.token };
}

export async function getSilentIdentity(expectedAccountId: string): Promise<GoogleIdentity> {
  requireOauthConfiguration();
  const account = await assertCurrentAccount(expectedAccountId);
  const result = await chrome.identity.getAuthToken({ interactive: false });
  if (!result.token) throw new Error('Reconnect Google Sheets to resume syncing.');
  return { ...account, token: result.token };
}

export async function assertCurrentAccount(expectedAccountId: string): Promise<{ accountId: string; email: string }> {
  let account: { accountId: string; email: string };
  try {
    account = requireProfile(await profile());
  } catch {
    throw new IdentityBoundaryError('The Chrome Google account was disconnected.');
  }
  if (account.accountId !== expectedAccountId) throw new IdentityBoundaryError('The Chrome Google account changed.');
  return account;
}

export async function disconnectGoogleIdentity(): Promise<void> {
  await chrome.identity.clearAllCachedAuthTokens();
}

export async function removeCachedToken(token: string): Promise<void> {
  await chrome.identity.removeCachedAuthToken({ token });
}

export class IdentityBoundaryError extends Error {}

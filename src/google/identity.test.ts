import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectGoogleIdentity, oauthConfigured } from './identity';

describe('OAuth client configuration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('recognizes the checked-in placeholder and explains setup before opening OAuth', async () => {
    const getAuthToken = vi.fn();
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({ oauth2: { client_id: '000000000000-placeholder.apps.googleusercontent.com' } }) },
      identity: { getAuthToken },
    });
    expect(oauthConfigured()).toBe(false);
    await expect(connectGoogleIdentity()).rejects.toThrow('OAuth client ID');
    expect(getAuthToken).not.toHaveBeenCalled();
  });

  it('accepts a configured public Chrome OAuth client ID', () => {
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({ oauth2: { client_id: '123456789012-example.apps.googleusercontent.com' } }) },
    });
    expect(oauthConfigured()).toBe(true);
  });
});

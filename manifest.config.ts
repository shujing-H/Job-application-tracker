import { defineManifest } from '@crxjs/vite-plugin';
import { loadEnv } from 'vite';

export default defineManifest(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const googleClientId = env.GOOGLE_OAUTH_CLIENT_ID
    || '000000000000-replace-with-your-client-id.apps.googleusercontent.com';
  return {
    manifest_version: 3,
    name: 'Job Application Tracker',
    version: '0.2.2',
    description: 'Keeps drafts local and syncs only confirmed applications to your Google Sheet.',
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsriC+x51Iz/WNF2WWBr4e2eYtzJkWbOORuknrpLjI6UfQIIv58w2yzThiol18yAzxggsfiMdFQ6D00v4AQxuHac5CqtKUEulrobXmyZsDnDkM3HEQ0uN3/UNUVXhr1zlf3B4iVFxAeDPPJXyZuDGIZlLMXE0fMblcD78h3LxPb3LysiMh9BFjFyP6/Rax/vfPtI/UTecw7ziSik2deI8ELC3EGijeAgFYfj/2jwfXRNm9oJ8Swl+3xmvEKdw708PSIOfyQ0DRjt3QAAbZvFjKWOSBVlVOSKjzKHoYbV+IsGPmx1Ue6CifAa4kK9klJk9mjtAvVG19mOCN0mdQ82v9wIDAQAB',
    permissions: ['storage', 'alarms', 'notifications', 'identity', 'identity.email'],
    host_permissions: [
      'https://www.linkedin.com/jobs/*',
      'https://app.joinhandshake.com/*',
      'https://*.myworkdayjobs.com/*',
      'https://boards.greenhouse.io/*',
      'https://job-boards.greenhouse.io/*',
      'https://job-boards.eu.greenhouse.io/*',
      'https://sheets.googleapis.com/*',
    ],
    oauth2: {
      client_id: googleClientId,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    },
    background: {
      service_worker: 'src/background/service-worker.ts',
      type: 'module',
    },
    action: {
      default_popup: 'src/popup/index.html',
      default_title: 'Job Application Tracker',
    },
    content_scripts: [
      {
        matches: [
          'https://www.linkedin.com/jobs/*',
          'https://app.joinhandshake.com/*',
          'https://*.myworkdayjobs.com/*',
          'https://boards.greenhouse.io/*',
          'https://job-boards.greenhouse.io/*',
          'https://job-boards.eu.greenhouse.io/*',
        ],
        js: ['src/content/index.ts'],
        run_at: 'document_idle',
      },
    ],
    icons: {
      128: 'icon128.png',
    },
  };
});

import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Job Application Tracker',
  version: '0.2.0',
  description: 'Keeps drafts local and syncs only confirmed applications to your Google Sheet.',
  permissions: ['storage', 'alarms', 'notifications', 'identity', 'identity.email'],
  host_permissions: [
    'https://www.linkedin.com/jobs/*',
    'https://app.joinhandshake.com/*',
    'https://*.myworkdayjobs.com/*',
    'https://boards.greenhouse.io/*',
    'https://job-boards.greenhouse.io/*',
    'https://sheets.googleapis.com/*'
  ],
  oauth2: {
    client_id: '000000000000-replace-with-your-client-id.apps.googleusercontent.com',
    scopes: ['https://www.googleapis.com/auth/drive.file']
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module'
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Job Application Tracker'
  },
  content_scripts: [
    {
      matches: [
        'https://www.linkedin.com/jobs/*',
        'https://app.joinhandshake.com/*',
        'https://*.myworkdayjobs.com/*',
        'https://boards.greenhouse.io/*',
        'https://job-boards.greenhouse.io/*'
      ],
      js: ['src/content/index.ts'],
      run_at: 'document_idle'
    }
  ],
  icons: {
    128: 'icon128.png'
  }
});

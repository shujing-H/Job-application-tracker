import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Job Application Tracker',
  version: '0.1.0',
  description: 'Keeps job-application drafts locally until submission is confirmed.',
  permissions: ['storage', 'alarms', 'notifications'],
  host_permissions: [
    'https://www.linkedin.com/jobs/*',
    'https://app.joinhandshake.com/*',
    'https://*.myworkdayjobs.com/*',
    'https://boards.greenhouse.io/*',
    'https://job-boards.greenhouse.io/*'
  ],
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
    128: 'icon.svg'
  }
});

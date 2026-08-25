import type { CapturedJob, JobSource } from '../domain/model';

type Rules = {
  source: JobSource;
  company: string[];
  role: string[];
  location: string[];
  description: string[];
};

const RULES: Array<{ host: RegExp; rules: Rules }> = [
  {
    host: /(^|\.)linkedin\.com$/,
    rules: {
      source: 'LinkedIn',
      company: ['.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name'],
      role: ['h1.t-24', '.job-details-jobs-unified-top-card__job-title h1', 'h1'],
      location: ['.job-details-jobs-unified-top-card__primary-description-container', '.jobs-unified-top-card__bullet'],
      description: ['#job-details', '.jobs-description__content'],
    },
  },
  {
    host: /(^|\.)joinhandshake\.com$/,
    rules: { source: 'Handshake', company: ['[data-hook="employer-name"]', 'main a[href*="employers"]'], role: ['h1'], location: ['[data-hook="job-location"]'], description: ['[data-hook="job-description"]', 'main'] },
  },
  {
    host: /\.myworkdayjobs\.com$/,
    rules: { source: 'Workday', company: ['[data-automation-id="company"]', 'header img[alt]'], role: ['[data-automation-id="jobPostingHeader"] h2', 'h2'], location: ['[data-automation-id="locations"]'], description: ['[data-automation-id="jobPostingDescription"]'] },
  },
  {
    host: /(^|\.)greenhouse\.io$/,
    rules: { source: 'Greenhouse', company: ['.company-name', '#header .company-name', 'meta[property="og:site_name"]'], role: ['h1'], location: ['.location'], description: ['#content', '.job__description'] },
  },
];

function text(selectors: string[]): string {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const value = element instanceof HTMLMetaElement ? element.content : element?.textContent;
    if (value?.trim()) return value.replace(/\s+/g, ' ').trim();
  }
  return '';
}

export function extractJob(): CapturedJob | undefined {
  const match = RULES.find(({ host }) => host.test(location.hostname));
  if (!match) return undefined;
  const role = text(match.rules.role);
  const jdSnapshot = text(match.rules.description);
  if (!role || jdSnapshot.length < 80) return undefined;
  return {
    company: text(match.rules.company),
    role,
    location: text(match.rules.location),
    jobUrl: location.href,
    source: match.rules.source,
    jdSnapshot,
  };
}

export function hasHighConfidenceSuccessMessage(): boolean {
  const visibleText = document.body.innerText.toLowerCase();
  return [
    'application submitted',
    'application has been submitted',
    'thank you for applying',
    'thanks for applying',
  ].some((phrase) => visibleText.includes(phrase));
}

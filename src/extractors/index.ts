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
    rules: {
      source: 'Greenhouse',
      company: ['.company-name', '#header .company-name', 'meta[property="og:site_name"]', 'main img[alt$=" Logo"]'],
      role: ['h1'],
      location: ['.location', '.job__location'],
      description: ['#content', '.job__description'],
    },
  },
];

function clean(value: string | null | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function text(selectors: string[]): string {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const value = element instanceof HTMLMetaElement
      ? element.content
      : element instanceof HTMLImageElement
        ? element.alt
        : element?.textContent;
    if (clean(value)) return clean(value);
  }
  return '';
}

export function parseLinkedInSemanticHeader(paragraphs: string[], company: string): { role: string; location: string } {
  const values = paragraphs.map(clean).filter(Boolean);
  const normalizedCompany = clean(company).toLocaleLowerCase();
  const companyIndex = values.findIndex((value) => value.toLocaleLowerCase() === normalizedCompany);
  if (companyIndex < 0) return { role: '', location: '' };
  const role = values[companyIndex + 1] ?? '';
  const locationSummary = values[companyIndex + 2] ?? '';
  return { role, location: locationSummary.split(/\s+[·•]\s+/)[0] ?? '' };
}

function linkedInSemanticJob(): Pick<CapturedJob, 'company' | 'role' | 'location' | 'jdSnapshot'> | undefined {
  const root = document.querySelector<HTMLElement>('[aria-label="Primary content"]');
  if (!root) return undefined;
  const company = clean(root.querySelector('[aria-label^="Company,"]')?.textContent
    ?? root.querySelector('a[href*="/company/"]')?.textContent);
  const header = parseLinkedInSemanticHeader(
    [...root.querySelectorAll('p')].map((paragraph) => paragraph.textContent ?? ''),
    company,
  );
  const aboutHeading = [...root.querySelectorAll('h2')]
    .find((heading) => clean(heading.textContent).toLowerCase() === 'about the job');
  const aboutContainer = aboutHeading?.parentElement?.parentElement;
  const descriptionText = aboutContainer?.innerText;
  const jdSnapshot = clean(descriptionText).replace(/^about the job\s*/i, '');
  if (!header.role || jdSnapshot.length < 80) return undefined;
  return { company, role: header.role, location: header.location, jdSnapshot };
}

export function extractJob(): CapturedJob | undefined {
  const match = RULES.find(({ host }) => host.test(location.hostname));
  if (!match) return undefined;
  // A LinkedIn search page contains many job cards and can surface text from a
  // previous selection. Capture only the dedicated detail route until the
  // split-pane DOM has a similarly reliable, isolated semantic boundary.
  if (match.rules.source === 'LinkedIn' && location.pathname === '/jobs/search-results/') return undefined;
  const linkedInSemantic = match.rules.source === 'LinkedIn' ? linkedInSemanticJob() : undefined;
  let company = text(match.rules.company) || linkedInSemantic?.company || '';
  if (match.rules.source === 'Greenhouse') company = company.replace(/\s+Logo$/i, '');
  const role = text(match.rules.role) || linkedInSemantic?.role || '';
  const locationText = text(match.rules.location) || linkedInSemantic?.location || '';
  const jdSnapshot = text(match.rules.description) || linkedInSemantic?.jdSnapshot || '';
  if (!role || jdSnapshot.length < 80) return undefined;
  return {
    company,
    role,
    location: locationText,
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

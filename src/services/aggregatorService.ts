import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { and, count, desc, eq, lt, ne, or } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  categories,
  companies,
  jobAlerts,
  jobs,
  jobSources,
  platformSettings,
  syncLogs,
} from '../db/schema.ts';
import { sendJobAlertEmail } from './emailService.ts';
import { expandSearchTerms } from './searchService.ts';

interface NormalizedExternalJob {
  externalId: string;
  title: string;
  companyName: string;
  companyLogo?: string | null;
  description: string;
  requirements: string;
  skills: string[];
  employmentType: string;
  experienceLevel: string;
  location: string;
  workArrangement: string;
  salaryText?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  publishedAt: Date;
  deadlineAt?: Date | null;
  applicationEmail?: string | null;
  applicationUrl: string;
  applicationInstructions?: string | null;
  sourceUrl: string;
  rawCategory?: string;
}

const USER_AGENT = 'KelvsJobSearch/1.0 (+https://kelvsjobsearch.app)';

function stripHtmlToReadableText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/?(p|div|h1|h2|h3|h4|h5|h6|br|tr)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function extractPublicEmailIfPresent(text: string): string | null {
  const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  const matches = text.match(emailRegex);
  if (!matches) return null;
  for (const candidate of matches) {
    const lower = candidate.toLowerCase();
    if (
      !lower.includes('example.com') &&
      !lower.includes('noreply') &&
      !lower.includes('no-reply') &&
      !lower.endsWith('.png') &&
      !lower.endsWith('.jpg')
    ) {
      return candidate;
    }
  }
  return null;
}

function extractApplicationInstructions(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim());
  const relevant = lines.filter((line) => {
    const lower = line.toLowerCase();
    return (
      (lower.includes('subject:') ||
        lower.includes('subject line') ||
        lower.includes('required documents') ||
        lower.includes('include your cv') ||
        lower.includes('attach your resume') ||
        lower.includes('send your cv') ||
        lower.includes('how to apply')) &&
      line.length > 10 &&
      line.length < 240
    );
  });
  return relevant.length > 0 ? relevant.slice(0, 2).join(' ') : null;
}

function extractRequirementsSection(fullText: string): string {
  const markers = [
    'requirements',
    'qualifications',
    'what you bring',
    "what we're looking for",
    'skills required',
    'who you are',
    'experience',
  ];
  const lower = fullText.toLowerCase();
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      const slice = fullText.slice(idx, idx + 1200).trim();
      if (slice.length > 40) return slice;
    }
  }
  return fullText.slice(0, 600);
}

function extractSkills(text: string, tags: string[] = []): string[] {
  const knownSkills = [
    'JavaScript',
    'TypeScript',
    'React',
    'React Native',
    'Flutter',
    'Swift',
    'Kotlin',
    'Next.js',
    'Node.js',
    'Python',
    'PostgreSQL',
    'SQL',
    'HTML',
    'CSS',
    'Tailwind CSS',
    'WordPress',
    'Webflow',
    'Shopify',
    'Figma',
    'Photoshop',
    'Illustrator',
    'Graphic Design',
    'UI/UX',
    'AWS',
    'Docker',
    'Kubernetes',
    'Java',
    'Go',
    'GraphQL',
    'REST API',
    'Cybersecurity',
    'SIEM',
    'SEO',
    'Google Analytics',
    'Excel',
    'Accounting',
    'Customer Support',
    'CRM',
  ];
  const found = new Set<string>();
  for (const t of tags) {
    const cleaned = t.trim();
    if (cleaned && cleaned.length <= 28) found.add(cleaned);
  }
  const lower = text.toLowerCase();
  for (const skill of knownSkills) {
    if (lower.includes(skill.toLowerCase())) {
      found.add(skill);
    }
  }
  return Array.from(found).slice(0, 8);
}

function inferEmploymentType(raw: string, text: string): string {
  const combined = `${raw} ${text}`.toLowerCase();
  if (combined.includes('intern') || combined.includes('internship')) return 'Internship';
  if (combined.includes('part-time') || combined.includes('part time')) return 'Part-time';
  if (combined.includes('contract') || combined.includes('freelance')) return 'Contract';
  return 'Full-time';
}

function inferExperienceLevel(title: string, text: string): string {
  const combined = `${title} ${text.slice(0, 500)}`.toLowerCase();
  if (combined.includes('intern') || combined.includes('graduate') || combined.includes('trainee')) {
    return combined.includes('graduate') ? 'Graduate' : 'Entry-level';
  }
  if (combined.includes('junior') || combined.includes('entry level') || combined.includes('entry-level')) {
    return 'Entry-level';
  }
  if (combined.includes('principal') || combined.includes('staff') || combined.includes('lead') || combined.includes('director')) {
    return 'Lead';
  }
  if (combined.includes('senior') || combined.includes('sr.')) return 'Senior';
  return 'Mid-level';
}

function inferWorkArrangement(location: string, rawRemote: boolean | undefined, title: string, desc: string): string {
  const combined = `${location} ${title} ${desc.slice(0, 300)}`.toLowerCase();
  if (combined.includes('hybrid')) return 'Hybrid';
  if (rawRemote === true || combined.includes('remote') || combined.includes('worldwide') || combined.includes('anywhere')) {
    return 'Remote';
  }
  if (rawRemote === false) return 'Onsite';
  return 'Onsite';
}

function createSlug(title: string, company: string, uniqueSeed: string): string {
  const base = `${title}-${company}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 65);
  const hash = crypto.createHash('sha1').update(uniqueSeed).digest('hex').slice(0, 7);
  return `${base || 'job'}-${hash}`;
}

export function computeDedupHash(title: string, companyName: string): string {
  const normTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const normCompany = companyName
    .toLowerCase()
    .replace(/\b(inc|ltd|llc|gmbh|corp|co)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return crypto.createHash('sha256').update(`${normTitle}::${normCompany}`).digest('hex').slice(0, 24);
}

async function classifyCategory(
  title: string,
  description: string,
  rawCategory: string | undefined,
  categoryList: Array<{ id: number; slug: string; name: string; keywords: string[] }>
) {
  const text = `${title} ${rawCategory || ''} ${description.slice(0, 500)}`.toLowerCase();

  let bestCat = categoryList.find((c) => c.slug === 'technology-and-it') || categoryList[0];
  let bestScore = 0;

  for (const cat of categoryList) {
    let score = 0;
    for (const kw of cat.keywords) {
      const lowerKw = kw.toLowerCase();
      if (title.toLowerCase().includes(lowerKw)) score += 5;
      else if (text.includes(lowerKw)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }

  return bestCat;
}

async function fetchRemotiveJobs(
  endpointUrl: string,
  limit = 60,
  timeoutMs = 10000
): Promise<NormalizedExternalJob[]> {
  const res = await fetch(endpointUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Remotive API HTTP ${res.status}`);
  const data = (await res.json()) as { jobs?: Array<Record<string, unknown>> };
  const items = Array.isArray(data.jobs) ? data.jobs : [];

  return items.slice(0, limit).map((item) => {
    const title = String(item.title || 'Untitled Position');
    const companyName = String(item.company_name || 'Unknown Employer');
    const rawHtml = String(item.description || '');
    const cleanText = stripHtmlToReadableText(rawHtml);
    const location = String(item.candidate_required_location || 'Worldwide (Remote)');
    const salaryText = item.salary ? String(item.salary).trim() || null : null;
    const url = String(item.url || '');
    const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];

    return {
      externalId: `remotive-${item.id}`,
      title,
      companyName,
      companyLogo: item.company_logo ? String(item.company_logo) : null,
      description: cleanText || title,
      requirements: extractRequirementsSection(cleanText || title),
      skills: extractSkills(cleanText, tags),
      employmentType: inferEmploymentType(String(item.job_type || ''), cleanText),
      experienceLevel: inferExperienceLevel(title, cleanText),
      location,
      workArrangement: inferWorkArrangement(location, true, title, cleanText),
      salaryText,
      publishedAt: item.publication_date ? new Date(String(item.publication_date)) : new Date(),
      applicationEmail: extractPublicEmailIfPresent(cleanText),
      applicationUrl: url,
      applicationInstructions: extractApplicationInstructions(cleanText),
      sourceUrl: url,
      rawCategory: item.category ? String(item.category) : undefined,
    };
  });
}

async function fetchArbeitnowJobs(endpointUrl: string): Promise<NormalizedExternalJob[]> {
  const res = await fetch(endpointUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Arbeitnow API HTTP ${res.status}`);
  const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const items = Array.isArray(data.data) ? data.data : [];

  return items.slice(0, 80).map((item) => {
    const title = String(item.title || 'Untitled Position');
    const companyName = String(item.company_name || 'Unknown Employer');
    const cleanText = stripHtmlToReadableText(String(item.description || ''));
    const location = String(item.location || (item.remote ? 'Remote' : 'Europe'));
    const url = String(item.url || '');
    const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
    const jobTypes = Array.isArray(item.job_types) ? item.job_types.map(String).join(' ') : '';
    const createdAtEpoch = Number(item.created_at || 0);

    return {
      externalId: `arbeitnow-${item.slug || createSlug(title, companyName, url)}`,
      title,
      companyName,
      companyLogo: null,
      description: cleanText || title,
      requirements: extractRequirementsSection(cleanText || title),
      skills: extractSkills(cleanText, tags),
      employmentType: inferEmploymentType(jobTypes, cleanText),
      experienceLevel: inferExperienceLevel(title, cleanText),
      location,
      workArrangement: inferWorkArrangement(location, Boolean(item.remote), title, cleanText),
      salaryText: null,
      publishedAt: createdAtEpoch > 0 ? new Date(createdAtEpoch * 1000) : new Date(),
      applicationEmail: extractPublicEmailIfPresent(cleanText),
      applicationUrl: url,
      applicationInstructions: extractApplicationInstructions(cleanText),
      sourceUrl: url,
      rawCategory: tags.join(' '),
    };
  });
}

async function fetchJobicyJobs(
  endpointUrl: string,
  limit = 45,
  timeoutMs = 10000
): Promise<NormalizedExternalJob[]> {
  const res = await fetch(endpointUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Jobicy API HTTP ${res.status}`);
  const data = (await res.json()) as { jobs?: Array<Record<string, unknown>> };
  const items = Array.isArray(data.jobs) ? data.jobs : [];

  return items.slice(0, limit).map((item) => {
    const title = String(item.jobTitle || 'Untitled Position');
    const companyName = String(item.companyName || 'Unknown Employer');
    const cleanText = stripHtmlToReadableText(String(item.jobDescription || item.jobExcerpt || ''));
    const location = String(item.jobGeo || 'Worldwide (Remote)');
    const url = String(item.url || '');
    const minSal = item.annualSalaryMin ? Number(item.annualSalaryMin) : null;
    const maxSal = item.annualSalaryMax ? Number(item.annualSalaryMax) : null;
    const currency = item.salaryCurrency ? String(item.salaryCurrency) : 'USD';
    const salaryText =
      minSal && maxSal
        ? `${currency} ${minSal.toLocaleString()} - ${maxSal.toLocaleString()} / yr`
        : minSal
          ? `From ${currency} ${minSal.toLocaleString()} / yr`
          : null;

    return {
      externalId: `jobicy-${item.id || createSlug(title, companyName, url)}`,
      title,
      companyName,
      companyLogo: item.companyLogo ? String(item.companyLogo) : null,
      description: cleanText || title,
      requirements: extractRequirementsSection(cleanText || title),
      skills: extractSkills(cleanText, Array.isArray(item.jobIndustry) ? item.jobIndustry.map(String) : []),
      employmentType: inferEmploymentType(
        Array.isArray(item.jobType) ? item.jobType.join(' ') : String(item.jobType || ''),
        cleanText
      ),
      experienceLevel: inferExperienceLevel(
        `${title} ${String(item.jobLevel || '')}`,
        cleanText
      ),
      location,
      workArrangement: 'Remote',
      salaryText,
      salaryMin: minSal,
      salaryMax: maxSal,
      salaryCurrency: minSal ? currency : null,
      publishedAt: item.pubDate ? new Date(String(item.pubDate)) : new Date(),
      applicationEmail: extractPublicEmailIfPresent(cleanText),
      applicationUrl: url,
      applicationInstructions: extractApplicationInstructions(cleanText),
      sourceUrl: url,
      rawCategory: Array.isArray(item.jobIndustry) ? item.jobIndustry.join(' ') : undefined,
    };
  });
}

async function fetchRemoteOkJobs(
  endpointUrl: string,
  limit = 60,
  timeoutMs = 10000
): Promise<NormalizedExternalJob[]> {
  const res = await fetch(endpointUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`RemoteOK API HTTP ${res.status}`);
  const data = (await res.json()) as Array<Record<string, unknown>>;
  if (!Array.isArray(data)) return [];

  const items = data.filter((entry) => entry && typeof entry.position === 'string' && entry.id);

  return items.slice(0, limit).map((item) => {
    const title = String(item.position || 'Untitled Position');
    const companyName = String(item.company || 'Unknown Employer');
    const cleanText = stripHtmlToReadableText(String(item.description || ''));
    const location = String(item.location || 'Worldwide (Remote)');
    const url = String(item.apply_url || item.url || '');
    const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
    const minSal = item.salary_min && Number(item.salary_min) > 0 ? Number(item.salary_min) : null;
    const maxSal = item.salary_max && Number(item.salary_max) > 0 ? Number(item.salary_max) : null;
    const salaryText =
      minSal && maxSal
        ? `$${minSal.toLocaleString()} - $${maxSal.toLocaleString()} / yr`
        : minSal
          ? `From $${minSal.toLocaleString()} / yr`
          : null;

    return {
      externalId: `remoteok-${item.id}`,
      title,
      companyName,
      companyLogo: item.company_logo ? String(item.company_logo) : null,
      description: cleanText || title,
      requirements: extractRequirementsSection(cleanText || title),
      skills: extractSkills(cleanText, tags),
      employmentType: inferEmploymentType('', cleanText),
      experienceLevel: inferExperienceLevel(title, cleanText),
      location,
      workArrangement: inferWorkArrangement(location, true, title, cleanText),
      salaryText,
      salaryMin: minSal,
      salaryMax: maxSal,
      salaryCurrency: minSal ? 'USD' : null,
      publishedAt: item.date ? new Date(String(item.date)) : new Date(),
      applicationEmail: extractPublicEmailIfPresent(cleanText),
      applicationUrl: url,
      applicationInstructions: extractApplicationInstructions(cleanText),
      sourceUrl: String(item.url || url),
      rawCategory: tags.join(' '),
    };
  });
}

async function fetchHimalayasJobs(
  endpointUrl: string,
  limit = 50,
  timeoutMs = 10000
): Promise<NormalizedExternalJob[]> {
  const res = await fetch(endpointUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Himalayas API HTTP ${res.status}`);
  const data = (await res.json()) as { jobs?: Array<Record<string, unknown>> };
  const items = Array.isArray(data.jobs) ? data.jobs : [];

  return items.slice(0, limit).map((item) => {
    const title = String(item.title || 'Untitled Position');
    const companyName = String(item.companyName || 'Unknown Employer');
    const cleanText = stripHtmlToReadableText(String(item.description || item.excerpt || ''));
    const restrictions = Array.isArray(item.locationRestrictions)
      ? item.locationRestrictions.map(String)
      : [];
    const location = restrictions.length > 0 ? restrictions.join(', ') : 'Worldwide (Remote)';
    const url = String(item.applicationLink || item.guid || '');
    const categoriesArr = Array.isArray(item.categories) ? item.categories.map(String) : [];
    const minSal = item.minSalary && Number(item.minSalary) > 0 ? Number(item.minSalary) : null;
    const maxSal = item.maxSalary && Number(item.maxSalary) > 0 ? Number(item.maxSalary) : null;
    const currency = item.currency ? String(item.currency) : 'USD';
    const salaryText =
      minSal && maxSal
        ? `${currency} ${minSal.toLocaleString()} - ${maxSal.toLocaleString()} / yr`
        : minSal
          ? `From ${currency} ${minSal.toLocaleString()} / yr`
          : null;
    const pubEpoch = Number(item.pubDate || 0);

    return {
      externalId: `himalayas-${item.guid || createSlug(title, companyName, url)}`,
      title,
      companyName,
      companyLogo: item.companyLogo ? String(item.companyLogo) : null,
      description: cleanText || title,
      requirements: extractRequirementsSection(cleanText || title),
      skills: extractSkills(cleanText, categoriesArr),
      employmentType: inferEmploymentType(String(item.employmentType || ''), cleanText),
      experienceLevel: inferExperienceLevel(
        `${title} ${Array.isArray(item.seniority) ? item.seniority.join(' ') : ''}`,
        cleanText
      ),
      location,
      workArrangement: 'Remote',
      salaryText,
      salaryMin: minSal,
      salaryMax: maxSal,
      salaryCurrency: minSal ? currency : null,
      publishedAt:
        pubEpoch > 1_000_000_000
          ? new Date(pubEpoch * 1000)
          : item.pubDate
            ? new Date(String(item.pubDate))
            : new Date(),
      applicationEmail: extractPublicEmailIfPresent(cleanText),
      applicationUrl: url,
      applicationInstructions: extractApplicationInstructions(cleanText),
      sourceUrl: String(item.guid || url),
      rawCategory: categoriesArr.join(' '),
    };
  });
}

async function fetchRssFeedJobs(endpointUrl: string): Promise<NormalizedExternalJob[]> {
  const res = await fetch(endpointUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`RSS feed HTTP ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const parsed = parser.parse(xml) as Record<string, any>;

  const channelItems = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
  const items: Array<Record<string, any>> = Array.isArray(channelItems)
    ? channelItems
    : channelItems
      ? [channelItems]
      : [];

  return items.slice(0, 40).map((item, idx) => {
    const rawTitle = String(item.title?.['#text'] || item.title || 'Untitled Position');
    let companyName = String(item['dc:creator'] || item.author?.name || item.company || '');
    let title = rawTitle;

    if (!companyName && rawTitle.includes(':')) {
      const parts = rawTitle.split(':');
      companyName = parts[0].trim();
      title = parts.slice(1).join(':').trim();
    } else if (!companyName && rawTitle.includes(' at ')) {
      const parts = rawTitle.split(' at ');
      title = parts[0].trim();
      companyName = parts.slice(1).join(' at ').trim();
    }
    if (!companyName) companyName = 'Employer via RSS Feed';

    const link = String(
      item.link?.['@_href'] || item.link || item.guid?.['#text'] || item.guid || endpointUrl
    );
    const rawDesc = String(
      item['content:encoded'] || item.content?.['#text'] || item.description || item.summary || ''
    );
    const cleanText = stripHtmlToReadableText(rawDesc);
    const location = String(item.region || item.location || 'Remote / Check Listing');
    const pubDate = item.pubDate || item.published || item.updated;

    return {
      externalId: `rss-${createSlug(title, companyName, `${link}-${idx}`)}`,
      title,
      companyName,
      companyLogo: null,
      description: cleanText || title,
      requirements: extractRequirementsSection(cleanText || title),
      skills: extractSkills(cleanText),
      employmentType: inferEmploymentType('', cleanText),
      experienceLevel: inferExperienceLevel(title, cleanText),
      location,
      workArrangement: inferWorkArrangement(location, undefined, title, cleanText),
      salaryText: null,
      publishedAt: pubDate ? new Date(String(pubDate)) : new Date(),
      applicationEmail: extractPublicEmailIfPresent(cleanText),
      applicationUrl: link,
      applicationInstructions: extractApplicationInstructions(cleanText),
      sourceUrl: link,
    };
  });
}

async function fetchAdzunaJobs(
  endpointUrl: string,
  config: Record<string, string>
): Promise<NormalizedExternalJob[]> {
  const appId = process.env.ADZUNA_APP_ID || config.appId;
  const appKey = process.env.ADZUNA_APP_KEY || config.appKey;
  if (!appId || !appKey) {
    throw new Error(
      'Missing Adzuna credentials. Set ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables to enable.'
    );
  }

  const url = new URL(endpointUrl);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('results_per_page', '40');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Adzuna API HTTP ${res.status}`);
  const data = (await res.json()) as { results?: Array<Record<string, any>> };
  const items = Array.isArray(data.results) ? data.results : [];

  return items.map((item) => {
    const title = String(item.title || 'Untitled Position');
    const companyName = String(item.company?.display_name || 'Employer');
    const cleanText = stripHtmlToReadableText(String(item.description || ''));
    const location = String(item.location?.display_name || 'United Kingdom');
    const redirectUrl = String(item.redirect_url || '');
    const minSal = item.salary_min ? Math.round(Number(item.salary_min)) : null;
    const maxSal = item.salary_max ? Math.round(Number(item.salary_max)) : null;

    return {
      externalId: `adzuna-${item.id}`,
      title,
      companyName,
      companyLogo: null,
      description: cleanText || title,
      requirements: extractRequirementsSection(cleanText || title),
      skills: extractSkills(cleanText),
      employmentType: inferEmploymentType(String(item.contract_time || ''), cleanText),
      experienceLevel: inferExperienceLevel(title, cleanText),
      location,
      workArrangement: inferWorkArrangement(location, undefined, title, cleanText),
      salaryText:
        minSal && maxSal ? `£${minSal.toLocaleString()} - £${maxSal.toLocaleString()}` : null,
      salaryMin: minSal,
      salaryMax: maxSal,
      salaryCurrency: minSal ? 'GBP' : null,
      publishedAt: item.created ? new Date(String(item.created)) : new Date(),
      applicationEmail: extractPublicEmailIfPresent(cleanText),
      applicationUrl: redirectUrl,
      applicationInstructions: extractApplicationInstructions(cleanText),
      sourceUrl: redirectUrl,
      rawCategory: item.category?.label ? String(item.category.label) : undefined,
    };
  });
}

async function fetchCareerJsonJobs(
  endpointUrl: string,
  config: Record<string, string>
): Promise<NormalizedExternalJob[]> {
  const res = await fetch(endpointUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Career JSON feed HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, any>;
  const listKey = config.itemsKey || 'jobs';
  const rawItems = Array.isArray(data) ? data : Array.isArray(data[listKey]) ? data[listKey] : [];

  return rawItems.slice(0, 40).map((item: Record<string, any>, i: number) => {
    const title = String(item[config.titleField || 'title'] || item.text || 'Untitled Position');
    const companyName = String(
      item[config.companyField || 'company'] || config.companyName || 'Direct Employer'
    );
    const location = String(
      item[config.locationField || 'location'] || item.categories?.location || 'Check Listing'
    );
    const url = String(
      item[config.urlField || 'url'] || item.hostedUrl || item.absolute_url || endpointUrl
    );
    const cleanText = stripHtmlToReadableText(
      String(item[config.descriptionField || 'description'] || item.descriptionPlain || '')
    );

    return {
      externalId: `career-${item.id || i}-${createSlug(title, companyName, url)}`,
      title,
      companyName,
      companyLogo: null,
      description: cleanText || title,
      requirements: extractRequirementsSection(cleanText || title),
      skills: extractSkills(cleanText),
      employmentType: inferEmploymentType(String(item.commitment || ''), cleanText),
      experienceLevel: inferExperienceLevel(title, cleanText),
      location,
      workArrangement: inferWorkArrangement(location, undefined, title, cleanText),
      salaryText: null,
      publishedAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      applicationEmail: extractPublicEmailIfPresent(cleanText),
      applicationUrl: url,
      applicationInstructions: extractApplicationInstructions(cleanText),
      sourceUrl: url,
    };
  });
}

async function ingestNormalizedJobs(
  externalJobs: NormalizedExternalJob[],
  source: { id: number | null; name: string },
  categoryRows: Array<{ id: number; slug: string; name: string; keywords: string[] }>,
  options: {
    duplicateDetectionEnabled: boolean;
    autoVerifyTrustedSources: boolean;
  }
) {
  let added = 0;
  let merged = 0;
  const newlyAddedForAlerts: Array<{
    id: number;
    title: string;
    companyName: string;
    location: string;
    workArrangement: string;
    experienceLevel: string;
    categorySlug: string;
    sourceName: string;
    skills: string[];
    description: string;
  }> = [];

  for (const ext of externalJobs) {
    if (!ext.applicationUrl || !ext.title) continue;

    const dedupHash = computeDedupHash(ext.title, ext.companyName);
    const categoryMatch = await classifyCategory(
      ext.title,
      ext.description,
      ext.rawCategory,
      categoryRows
    );

    const existingByExternal = await db
      .select()
      .from(jobs)
      .where(eq(jobs.externalId, ext.externalId))
      .limit(1);

    if (existingByExternal.length > 0) {
      await db
        .update(jobs)
        .set({ lastVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(jobs.id, existingByExternal[0].id));
      continue;
    }

    if (options.duplicateDetectionEnabled) {
      const existingDuplicate = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.dedupHash, dedupHash), ne(jobs.status, 'expired')))
        .limit(1);

      if (existingDuplicate.length > 0) {
        const target = existingDuplicate[0];
        const currentAlts = Array.isArray(target.alternateSources)
          ? target.alternateSources
          : [];
        const alreadyRecorded =
          target.sourceName === source.name ||
          currentAlts.some((a) => a.sourceName === source.name);

        if (!alreadyRecorded) {
          await db
            .update(jobs)
            .set({
              alternateSources: [
                ...currentAlts,
                {
                  sourceName: source.name,
                  applicationUrl: ext.applicationUrl,
                  collectedAt: new Date().toISOString(),
                },
              ],
              lastVerifiedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, target.id));
          merged += 1;
        }
        continue;
      }
    }

    const companySlug =
      ext.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'employer';

    const companyRows = await db
      .insert(companies)
      .values({
        name: ext.companyName,
        slug: companySlug,
        logoUrl: ext.companyLogo || null,
      })
      .onConflictDoUpdate({
        target: companies.slug,
        set: { name: ext.companyName },
      })
      .returning();

    const initialStatus = options.autoVerifyTrustedSources ? 'verified' : 'active';
    const slug = createSlug(ext.title, ext.companyName, `${ext.externalId}-${Date.now()}`);

    const insertedJob = await db
      .insert(jobs)
      .values({
        title: ext.title.slice(0, 200),
        slug,
        companyId: companyRows[0]?.id ?? null,
        companyName: ext.companyName.slice(0, 140),
        companyLogo: ext.companyLogo || null,
        categoryId: categoryMatch?.id ?? null,
        categoryName: categoryMatch?.name ?? 'Technology and IT',
        description: ext.description,
        requirements: ext.requirements,
        skills: ext.skills,
        employmentType: ext.employmentType,
        experienceLevel: ext.experienceLevel,
        location: ext.location.slice(0, 120),
        workArrangement: ext.workArrangement,
        salaryText: ext.salaryText || null,
        salaryMin: ext.salaryMin || null,
        salaryMax: ext.salaryMax || null,
        salaryCurrency: ext.salaryCurrency || null,
        publishedAt: Number.isNaN(ext.publishedAt.getTime()) ? new Date() : ext.publishedAt,
        deadlineAt: ext.deadlineAt || null,
        applicationEmail: ext.applicationEmail || null,
        applicationUrl: ext.applicationUrl,
        applicationInstructions: ext.applicationInstructions || null,
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: ext.sourceUrl,
        externalId: ext.externalId,
        dedupHash,
        alternateSources: [],
        status: initialStatus,
        isSampleData: false,
        lastVerifiedAt: new Date(),
      })
      .returning();

    added += 1;

    if (insertedJob[0]) {
      newlyAddedForAlerts.push({
        id: insertedJob[0].id,
        title: insertedJob[0].title,
        companyName: insertedJob[0].companyName,
        location: insertedJob[0].location,
        workArrangement: insertedJob[0].workArrangement,
        experienceLevel: insertedJob[0].experienceLevel,
        categorySlug: categoryMatch?.slug || 'technology-and-it',
        sourceName: source.name,
        skills: insertedJob[0].skills || [],
        description: insertedJob[0].description,
      });
    }
  }

  return { added, merged, newlyAddedForAlerts };
}

export async function runExpiryAndVerificationCheck(expiryDaysThreshold: number): Promise<number> {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - expiryDaysThreshold * 24 * 60 * 60 * 1000);

  const expiredByRules = await db
    .update(jobs)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(
        ne(jobs.status, 'expired'),
        or(lt(jobs.deadlineAt, now), lt(jobs.publishedAt, cutoffDate))
      )
    )
    .returning({ id: jobs.id });

  let totalExpired = expiredByRules.length;

  const oldestChecked = await db
    .select({
      id: jobs.id,
      applicationUrl: jobs.applicationUrl,
      isSampleData: jobs.isSampleData,
    })
    .from(jobs)
    .where(and(ne(jobs.status, 'expired'), eq(jobs.isSampleData, false)))
    .orderBy(jobs.lastVerifiedAt)
    .limit(10);

  for (const job of oldestChecked) {
    if (!job.applicationUrl) continue;
    try {
      const checkRes = await fetch(job.applicationUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(4500),
      });
      if (checkRes.status === 404 || checkRes.status === 410) {
        await db
          .update(jobs)
          .set({ status: 'expired', lastVerifiedAt: now, updatedAt: now })
          .where(eq(jobs.id, job.id));
        totalExpired += 1;
      } else {
        await db
          .update(jobs)
          .set({ lastVerifiedAt: now, updatedAt: now })
          .where(eq(jobs.id, job.id));
      }
    } catch {
      // Network timeout does not expire valid jobs
    }
  }

  return totalExpired;
}

async function processInstantJobAlerts(
  newlyAddedJobs: Array<{
    id: number;
    title: string;
    companyName: string;
    location: string;
    workArrangement: string;
    experienceLevel: string;
    categorySlug: string;
    sourceName: string;
    skills: string[];
    description: string;
  }>
) {
  if (newlyAddedJobs.length === 0) return;

  const activeAlerts = await db
    .select()
    .from(jobAlerts)
    .where(and(eq(jobAlerts.isActive, true), eq(jobAlerts.frequency, 'instant')));

  for (const alert of activeAlerts) {
    const terms = expandSearchTerms(alert.keywords);
    const matches = newlyAddedJobs.filter((job) => {
      const hay = `${job.title} ${job.companyName} ${job.skills.join(' ')} ${job.description}`.toLowerCase();
      const matchesKeyword =
        !alert.keywords.trim() || terms.some((t) => hay.includes(t));
      const matchesCategory =
        !alert.categorySlug || alert.categorySlug === job.categorySlug;
      const matchesLocation =
        !alert.location ||
        job.location.toLowerCase().includes(alert.location.toLowerCase());
      const matchesWork =
        alert.workArrangement === 'Any' ||
        job.workArrangement.toLowerCase() === alert.workArrangement.toLowerCase();
      const matchesLevel =
        alert.experienceLevel === 'Any' ||
        job.experienceLevel.toLowerCase() === alert.experienceLevel.toLowerCase();

      return (
        matchesKeyword &&
        matchesCategory &&
        matchesLocation &&
        matchesWork &&
        matchesLevel
      );
    });

    if (matches.length > 0) {
      await sendJobAlertEmail(alert.email, alert.keywords || 'All Roles', matches);
      await db
        .update(jobAlerts)
        .set({ lastNotifiedAt: new Date() })
        .where(eq(jobAlerts.id, alert.id));
    }
  }
}

export async function syncJobSources(options: {
  sourceId?: number;
  triggerType: 'manual' | 'scheduled';
}) {
  const settingsRows = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'default'))
    .limit(1);
  const settings = settingsRows[0];

  const categoryRows = await db.select().from(categories);
  const targetSources = options.sourceId
    ? await db.select().from(jobSources).where(eq(jobSources.id, options.sourceId))
    : await db.select().from(jobSources).where(eq(jobSources.enabled, true));

  const summary = {
    sourcesProcessed: 0,
    jobsDiscovered: 0,
    jobsAdded: 0,
    duplicatesMerged: 0,
    jobsExpired: 0,
    skippedUnconfigured: [] as string[],
    errors: [] as Array<{ sourceName: string; error: string }>,
  };

  const newlyAddedForAlerts: Array<{
    id: number;
    title: string;
    companyName: string;
    location: string;
    workArrangement: string;
    experienceLevel: string;
    categorySlug: string;
    sourceName: string;
    skills: string[];
    description: string;
  }> = [];

  for (const source of targetSources) {
    if (source.sourceType === 'manual') continue;

    if (source.sourceType === 'adzuna_api') {
      const appId = process.env.ADZUNA_APP_ID || source.apiConfigJson?.appId;
      const appKey = process.env.ADZUNA_APP_KEY || source.apiConfigJson?.appKey;
      if (!appId || !appKey) {
        await db
          .update(jobSources)
          .set({ status: 'not_connected', lastError: null, updatedAt: new Date() })
          .where(eq(jobSources.id, source.id));
        await db.insert(syncLogs).values({
          sourceId: source.id,
          sourceName: source.name,
          triggerType: options.triggerType,
          status: 'not_connected',
          jobsDiscovered: 0,
          jobsAdded: 0,
          duplicatesMerged: 0,
          jobsExpired: 0,
          message:
            'Adzuna integration is not connected. Add ADZUNA_APP_ID and ADZUNA_APP_KEY when ready.',
          completedAt: new Date(),
        });
        summary.skippedUnconfigured.push(source.name);
        continue;
      }
    }

    summary.sourcesProcessed += 1;

    await db
      .update(jobSources)
      .set({ status: 'syncing', updatedAt: new Date() })
      .where(eq(jobSources.id, source.id));

    let discovered = 0;
    let added = 0;
    let merged = 0;

    try {
      let externalJobs: NormalizedExternalJob[] = [];
      if (source.sourceType === 'remotive_api') {
        externalJobs = await fetchRemotiveJobs(source.endpointUrl);
      } else if (source.sourceType === 'arbeitnow_api') {
        externalJobs = await fetchArbeitnowJobs(source.endpointUrl);
      } else if (source.sourceType === 'jobicy_api') {
        externalJobs = await fetchJobicyJobs(source.endpointUrl);
      } else if (source.sourceType === 'remoteok_api') {
        externalJobs = await fetchRemoteOkJobs(source.endpointUrl);
      } else if (source.sourceType === 'himalayas_api') {
        externalJobs = await fetchHimalayasJobs(source.endpointUrl);
      } else if (source.sourceType === 'rss_feed') {
        externalJobs = await fetchRssFeedJobs(source.endpointUrl);
      } else if (source.sourceType === 'adzuna_api') {
        externalJobs = await fetchAdzunaJobs(source.endpointUrl, source.apiConfigJson || {});
      } else if (source.sourceType === 'career_json') {
        externalJobs = await fetchCareerJsonJobs(source.endpointUrl, source.apiConfigJson || {});
      }

      discovered = externalJobs.length;
      summary.jobsDiscovered += discovered;

      const ingestResult = await ingestNormalizedJobs(externalJobs, source, categoryRows, {
        duplicateDetectionEnabled: !settings || settings.duplicateDetectionEnabled,
        autoVerifyTrustedSources: Boolean(settings?.autoVerifyTrustedSources),
      });

      added = ingestResult.added;
      merged = ingestResult.merged;
      summary.jobsAdded += added;
      summary.duplicatesMerged += merged;
      newlyAddedForAlerts.push(...ingestResult.newlyAddedForAlerts);

      await db
        .update(jobSources)
        .set({
          status: 'healthy',
          lastSyncedAt: new Date(),
          lastError: null,
          jobsCollectedCount: source.jobsCollectedCount + added,
          updatedAt: new Date(),
        })
        .where(eq(jobSources.id, source.id));

      await db.insert(syncLogs).values({
        sourceId: source.id,
        sourceName: source.name,
        triggerType: options.triggerType,
        status: 'success',
        jobsDiscovered: discovered,
        jobsAdded: added,
        duplicatesMerged: merged,
        jobsExpired: 0,
        message: `Synced ${discovered} listings: ${added} added, ${merged} duplicate listings grouped.`,
        completedAt: new Date(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'External feed sync failed';
      const isConfigErr = message.toLowerCase().includes('credentials') || message.toLowerCase().includes('missing');

      await db
        .update(jobSources)
        .set({
          status: isConfigErr ? 'needs_config' : 'error',
          lastError: message.slice(0, 300),
          updatedAt: new Date(),
        })
        .where(eq(jobSources.id, source.id));

      await db.insert(syncLogs).values({
        sourceId: source.id,
        sourceName: source.name,
        triggerType: options.triggerType,
        status: 'failed',
        jobsDiscovered: discovered,
        jobsAdded: added,
        duplicatesMerged: merged,
        jobsExpired: 0,
        message: message.slice(0, 300),
        completedAt: new Date(),
      });

      summary.errors.push({ sourceName: source.name, error: message });
    }
  }

  if (!settings || settings.autoExpiryCheckEnabled) {
    summary.jobsExpired = await runExpiryAndVerificationCheck(
      settings?.expiryDaysThreshold ?? 45
    );
  }

  if (settings) {
    await db
      .update(platformSettings)
      .set({ lastScheduledRunAt: new Date(), updatedAt: new Date() })
      .where(eq(platformSettings.id, settings.id));
  }

  await processInstantJobAlerts(newlyAddedForAlerts);

  return summary;
}

const liveQueryCache = new Map<string, number>();
const LIVE_QUERY_TTL_MS = 4 * 60 * 1000;

export async function federateLiveSearch(rawQuery: string): Promise<number> {
  const cleaned = rawQuery.trim().toLowerCase();
  if (!cleaned || cleaned.length < 2) return 0;

  const lastFetched = liveQueryCache.get(cleaned);
  if (lastFetched && Date.now() - lastFetched < LIVE_QUERY_TTL_MS) {
    return 0;
  }
  liveQueryCache.set(cleaned, Date.now());

  try {
    const categoryRows = await db.select().from(categories);
    const settingsRows = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'default'))
      .limit(1);
    const settings = settingsRows[0];

    const firstToken = cleaned.split(/\s+/)[0] || cleaned;
    const [remotiveRes, himalayasRes, jobicyRes] = await Promise.allSettled([
      fetchRemotiveJobs(
        `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(cleaned)}&limit=40`,
        40,
        4500
      ),
      fetchHimalayasJobs(
        `https://himalayas.app/jobs/api?limit=40&q=${encodeURIComponent(cleaned)}`,
        40,
        4500
      ),
      fetchJobicyJobs(
        `https://jobicy.com/api/v2/remote-jobs?count=30&tag=${encodeURIComponent(firstToken)}`,
        30,
        4500
      ),
    ]);

    const buckets: Array<{ name: string; items: NormalizedExternalJob[] }> = [];
    if (remotiveRes.status === 'fulfilled' && remotiveRes.value.length > 0) {
      buckets.push({ name: 'Remotive Live Search', items: remotiveRes.value });
    }
    if (himalayasRes.status === 'fulfilled' && himalayasRes.value.length > 0) {
      buckets.push({ name: 'Himalayas Live Search', items: himalayasRes.value });
    }
    if (jobicyRes.status === 'fulfilled' && jobicyRes.value.length > 0) {
      buckets.push({ name: 'Jobicy Live Search', items: jobicyRes.value });
    }

    let totalAdded = 0;
    for (const bucket of buckets) {
      const res = await ingestNormalizedJobs(
        bucket.items,
        { id: null, name: bucket.name },
        categoryRows,
        {
          duplicateDetectionEnabled: !settings || settings.duplicateDetectionEnabled,
          autoVerifyTrustedSources: Boolean(settings?.autoVerifyTrustedSources),
        }
      );
      totalAdded += res.added;
    }
    return totalAdded;
  } catch (err) {
    console.warn('Live search federation warning:', err);
    return 0;
  }
}

let warmupStarted = false;

export function triggerStartupLiveWarmup() {
  if (warmupStarted) return;
  warmupStarted = true;
  setTimeout(async () => {
    try {
      const liveRows = await db
        .select({ total: count() })
        .from(jobs)
        .where(and(eq(jobs.isSampleData, false), ne(jobs.status, 'expired')));
      const liveCount = Number(liveRows[0]?.total ?? 0);
      if (liveCount < 40) {
        await syncJobSources({ triggerType: 'scheduled' });
      }
    } catch (err) {
      console.warn('Startup live job warmup warning:', err);
    }
  }, 1500);
}

export async function getRecentSyncLogs(limit = 15) {
  return db.select().from(syncLogs).orderBy(desc(syncLogs.startedAt)).limit(limit);
}

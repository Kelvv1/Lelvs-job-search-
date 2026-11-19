import crypto from 'node:crypto';
import { DEFAULT_CATEGORIES, getSampleListingsTemplate } from '../db/seed.ts';
import type { CategoryItem, JobListing, SiteReviewItem } from '../types.ts';
import {
  classifyCategory,
  computeDedupHash,
  fetchArbeitnowJobs,
  fetchHimalayasJobs,
  fetchJobicyJobs,
  fetchRemoteOkJobs,
  fetchRemotiveJobs,
  NormalizedExternalJob,
} from './aggregatorService.ts';
import { expandSearchTerms, scoreJobRelevance } from './searchService.ts';

const FALLBACK_CATEGORIES_BASE = DEFAULT_CATEGORIES.map((cat, idx) => ({
  id: idx + 1,
  slug: cat.slug,
  name: cat.name,
  keywords: cat.keywords,
  description: cat.description,
}));

function hashStringToPositiveInt(seed: string): number {
  const hex = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 7);
  return (parseInt(hex, 16) % 900_000_000) + 10_000;
}

function buildSampleJobListings(): JobListing[] {
  const catBySlug = new Map(FALLBACK_CATEGORIES_BASE.map((c) => [c.slug, c]));
  const nowIso = new Date().toISOString();
  return getSampleListingsTemplate().map((item, idx) => {
    const cat = catBySlug.get(item.categorySlug) || FALLBACK_CATEGORIES_BASE[0];
    const companySlug = item.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const slug = `sample-${companySlug}-${idx + 1}`;
    return {
      id: idx + 1,
      title: item.title,
      slug,
      companyId: idx + 1,
      companyName: item.companyName,
      companyLogo: null,
      categoryId: cat.id,
      categoryName: cat.name,
      description: item.description,
      requirements: item.requirements,
      skills: item.skills,
      employmentType: item.employmentType,
      experienceLevel: item.experienceLevel,
      location: item.location,
      workArrangement: item.workArrangement,
      salaryText: item.salaryText,
      salaryMin: item.salaryMin,
      salaryMax: item.salaryMax,
      salaryCurrency: item.salaryCurrency,
      publishedAt: item.publishedAt.toISOString(),
      deadlineAt: item.deadlineAt ? item.deadlineAt.toISOString() : null,
      applicationEmail: null,
      applicationUrl: null,
      applicationInstructions: item.applicationInstructions,
      sourceId: null,
      sourceName: 'Sample Reference Listing',
      sourceUrl: null,
      alternateSources: [],
      status: item.status,
      isSampleData: true,
      lastVerifiedAt: nowIso,
      createdAt: item.publishedAt.toISOString(),
      isSaved: false,
    };
  });
}

async function normalizeToJobListing(
  ext: NormalizedExternalJob,
  sourceName: string
): Promise<JobListing> {
  const cat = await classifyCategory(
    ext.title,
    ext.description,
    ext.rawCategory,
    FALLBACK_CATEGORIES_BASE
  );
  const slugBase = `${ext.title}-${ext.companyName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const hash7 = crypto.createHash('sha1').update(ext.externalId).digest('hex').slice(0, 7);
  const slug = `${slugBase || 'job'}-${hash7}`;
  const nowIso = new Date().toISOString();

  return {
    id: hashStringToPositiveInt(ext.externalId),
    title: ext.title.slice(0, 200),
    slug,
    companyId: null,
    companyName: ext.companyName.slice(0, 140),
    companyLogo: ext.companyLogo || null,
    categoryId: cat.id,
    categoryName: cat.name,
    description: ext.description,
    requirements: ext.requirements,
    skills: ext.skills,
    employmentType: ext.employmentType,
    experienceLevel: ext.experienceLevel,
    location: ext.location.slice(0, 120),
    workArrangement: ext.workArrangement,
    salaryText: ext.salaryText || null,
    salaryMin: ext.salaryMin ?? null,
    salaryMax: ext.salaryMax ?? null,
    salaryCurrency: ext.salaryCurrency || null,
    publishedAt: Number.isNaN(ext.publishedAt.getTime())
      ? nowIso
      : ext.publishedAt.toISOString(),
    deadlineAt: ext.deadlineAt ? ext.deadlineAt.toISOString() : null,
    applicationEmail: ext.applicationEmail || null,
    applicationUrl: ext.applicationUrl,
    applicationInstructions: ext.applicationInstructions || null,
    sourceId: null,
    sourceName,
    sourceUrl: ext.sourceUrl,
    alternateSources: [],
    status: 'active',
    isSampleData: false,
    lastVerifiedAt: nowIso,
    createdAt: nowIso,
    isSaved: false,
  };
}

const fallbackStore = {
  jobsByKey: new Map<string, JobListing>(),
  lastWarmupAt: 0,
  queryCache: new Map<string, number>(),
  reviews: [] as SiteReviewItem[],
};

const WARMUP_TTL_MS = 4 * 60 * 1000;
const QUERY_TTL_MS = 4 * 60 * 1000;

function ensureSampleJobsInStore() {
  for (const sample of buildSampleJobListings()) {
    const key = `sample:${sample.slug}`;
    if (!fallbackStore.jobsByKey.has(key)) {
      fallbackStore.jobsByKey.set(key, sample);
    }
  }
}

async function mergeBucketIntoStore(items: NormalizedExternalJob[], sourceName: string) {
  const existingHashes = new Map<string, string>();
  for (const [k, existing] of fallbackStore.jobsByKey.entries()) {
    if (!existing.isSampleData) {
      existingHashes.set(computeDedupHash(existing.title, existing.companyName), k);
    }
  }

  for (const ext of items) {
    if (!ext.title || !ext.applicationUrl) continue;
    const hash = computeDedupHash(ext.title, ext.companyName);
    const existingKey = existingHashes.get(hash);
    if (existingKey) {
      const target = fallbackStore.jobsByKey.get(existingKey);
      if (
        target &&
        target.sourceName !== sourceName &&
        !target.alternateSources.some((a) => a.sourceName === sourceName)
      ) {
        target.alternateSources = [
          ...target.alternateSources,
          {
            sourceName,
            applicationUrl: ext.applicationUrl,
            collectedAt: new Date().toISOString(),
          },
        ];
      }
      continue;
    }

    const listing = await normalizeToJobListing(ext, sourceName);
    const key = `ext:${ext.externalId}`;
    fallbackStore.jobsByKey.set(key, listing);
    existingHashes.set(hash, key);
  }
}

async function ensureFallbackWarmup() {
  ensureSampleJobsInStore();

  const now = Date.now();
  if (now - fallbackStore.lastWarmupAt < WARMUP_TTL_MS && fallbackStore.jobsByKey.size > 20) {
    return;
  }
  fallbackStore.lastWarmupAt = now;

  const [remotive, himalayas, jobicy, remoteok, arbeitnow] = await Promise.allSettled([
    fetchRemotiveJobs('https://remotive.com/api/remote-jobs?limit=40', 40, 4500),
    fetchHimalayasJobs('https://himalayas.app/jobs/api?limit=35', 35, 4500),
    fetchJobicyJobs('https://jobicy.com/api/v2/remote-jobs?count=30', 30, 4500),
    fetchRemoteOkJobs('https://remoteok.com/api', 35, 4500),
    fetchArbeitnowJobs('https://www.arbeitnow.com/api/job-board-api'),
  ]);

  if (remotive.status === 'fulfilled') await mergeBucketIntoStore(remotive.value, 'Remotive');
  if (himalayas.status === 'fulfilled') await mergeBucketIntoStore(himalayas.value, 'Himalayas');
  if (jobicy.status === 'fulfilled') await mergeBucketIntoStore(jobicy.value, 'Jobicy');
  if (remoteok.status === 'fulfilled') await mergeBucketIntoStore(remoteok.value, 'RemoteOK');
  if (arbeitnow.status === 'fulfilled') await mergeBucketIntoStore(arbeitnow.value, 'Arbeitnow');
}

async function federateFallbackQuery(rawQuery: string) {
  const cleaned = rawQuery.trim().toLowerCase();
  if (!cleaned || cleaned.length < 2) return;

  const lastQueried = fallbackStore.queryCache.get(cleaned);
  if (lastQueried && Date.now() - lastQueried < QUERY_TTL_MS) return;
  fallbackStore.queryCache.set(cleaned, Date.now());

  const firstToken = cleaned.split(/\s+/)[0] || cleaned;
  const [remotive, himalayas, jobicy] = await Promise.allSettled([
    fetchRemotiveJobs(
      `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(cleaned)}&limit=35`,
      35,
      4500
    ),
    fetchHimalayasJobs(
      `https://himalayas.app/jobs/api?limit=35&q=${encodeURIComponent(cleaned)}`,
      35,
      4500
    ),
    fetchJobicyJobs(
      `https://jobicy.com/api/v2/remote-jobs?count=30&tag=${encodeURIComponent(firstToken)}`,
      30,
      4500
    ),
  ]);

  if (remotive.status === 'fulfilled') {
    await mergeBucketIntoStore(remotive.value, 'Remotive Live Search');
  }
  if (himalayas.status === 'fulfilled') {
    await mergeBucketIntoStore(himalayas.value, 'Himalayas Live Search');
  }
  if (jobicy.status === 'fulfilled') {
    await mergeBucketIntoStore(jobicy.value, 'Jobicy Live Search');
  }
}

export async function getFallbackCategories(): Promise<{
  categories: CategoryItem[];
  demoModeEnabled: boolean;
}> {
  await ensureFallbackWarmup();
  const counts = new Map<number, number>();
  for (const job of fallbackStore.jobsByKey.values()) {
    if (job.categoryId) {
      counts.set(job.categoryId, (counts.get(job.categoryId) ?? 0) + 1);
    }
  }
  return {
    categories: FALLBACK_CATEGORIES_BASE.map((c) => ({
      ...c,
      jobCount: counts.get(c.id) ?? 0,
    })),
    demoModeEnabled: true,
  };
}

export interface FallbackSearchParams {
  q?: string;
  location?: string;
  category?: string;
  workArrangement?: string;
  employmentType?: string;
  experienceLevel?: string;
  datePosted?: string;
  salaryMin?: number;
  sort?: string;
  origin?: string;
  page?: number;
  limit?: number;
}

export async function searchFallbackJobs(params: FallbackSearchParams) {
  await ensureFallbackWarmup();

  const q = String(params.q || '').trim();
  if (q) {
    await federateFallbackQuery(q);
  }

  const location = String(params.location || '').trim().toLowerCase();
  const categorySlug = String(params.category || '').trim();
  const workArrangement = String(params.workArrangement || '').trim();
  const employmentType = String(params.employmentType || '').trim();
  const experienceLevel = String(params.experienceLevel || '').trim();
  const datePosted = String(params.datePosted || '').trim();
  const salaryMin = Number(params.salaryMin || 0);
  const sort = String(params.sort || (q ? 'relevant' : 'recent'));
  const origin = String(params.origin || 'all');
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(200, Math.max(1, Number(params.limit || 60)));

  const matchedCat = categorySlug
    ? FALLBACK_CATEGORIES_BASE.find((c) => c.slug === categorySlug)
    : undefined;

  const msMap: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '14d': 14 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  const cutoffMs = datePosted && msMap[datePosted] ? Date.now() - msMap[datePosted] : null;
  const expandedTerms = expandSearchTerms(q);

  let filtered = Array.from(fallbackStore.jobsByKey.values()).filter((job) => {
    if (matchedCat && job.categoryId !== matchedCat.id) return false;
    if (workArrangement && workArrangement !== 'All' && job.workArrangement !== workArrangement) {
      return false;
    }
    if (employmentType && employmentType !== 'All' && job.employmentType !== employmentType) {
      return false;
    }
    if (experienceLevel && experienceLevel !== 'All' && job.experienceLevel !== experienceLevel) {
      return false;
    }
    if (origin === 'live' && job.isSampleData) return false;
    if (origin === 'sample' && !job.isSampleData) return false;
    if (cutoffMs && new Date(job.publishedAt).getTime() < cutoffMs) return false;
    if (location && !job.location.toLowerCase().includes(location)) return false;
    if (salaryMin > 0 && (job.salaryMax || job.salaryMin || 0) < salaryMin) return false;
    if (q) {
      return scoreJobRelevance(job, q, expandedTerms) > 0;
    }
    return true;
  });

  if (sort === 'relevant' && q) {
    filtered = filtered
      .map((job) => ({
        job,
        score: scoreJobRelevance(job, q, expandedTerms),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.job.publishedAt).getTime() - new Date(a.job.publishedAt).getTime();
      })
      .map((entry) => entry.job);
  } else if (sort === 'deadline') {
    filtered.sort((a, b) => {
      if (!a.deadlineAt && !b.deadlineAt) return 0;
      if (!a.deadlineAt) return 1;
      if (!b.deadlineAt) return -1;
      return new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime();
    });
  } else {
    filtered.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const paged = filtered.slice(offset, offset + limit);

  return {
    jobs: paged,
    total,
    page,
    totalPages,
    demoModeEnabled: true,
    expandedTerms: q ? expandedTerms.slice(0, 8) : [],
  };
}

export async function getFallbackJobById(idOrSlug: string) {
  await ensureFallbackWarmup();
  const numericId = Number(idOrSlug);
  const all = Array.from(fallbackStore.jobsByKey.values());
  const job =
    Number.isInteger(numericId) && numericId > 0
      ? all.find((j) => j.id === numericId)
      : all.find((j) => j.slug === idOrSlug);
  if (!job) return null;

  const relatedJobs = all
    .filter((j) => j.id !== job.id && j.categoryId === job.categoryId)
    .slice(0, 3);

  return { job, relatedJobs, demoModeEnabled: true };
}

export function getFallbackReviewsSnapshot() {
  const list = fallbackStore.reviews;
  const totalReviews = list.length;
  const averageRating =
    totalReviews > 0
      ? Number((list.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
      : 0;
  return {
    reviews: list.slice(0, 20),
    averageRating,
    totalReviews,
    reviewRecipientEmail: 'ebaluegbefodestiny@gmail.com',
  };
}

export function addFallbackReview(item: Omit<SiteReviewItem, 'id' | 'createdAt'>): SiteReviewItem {
  const created: SiteReviewItem = {
    id: fallbackStore.reviews.length + 1,
    reviewerName: item.reviewerName,
    reviewerEmail: item.reviewerEmail,
    rating: item.rating,
    comment: item.comment,
    emailStatus: item.emailStatus,
    createdAt: new Date().toISOString(),
  };
  fallbackStore.reviews.unshift(created);
  return created;
}

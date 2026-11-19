import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  ArrowRight,
  Mail,
  Phone,
  ExternalLink,
  Star,
  ArrowUpRight,
} from 'lucide-react';
import { AppView, CategoryItem, JobListing, SiteReviewItem } from '../types.ts';
import { JobCard } from './JobCard.tsx';
import {
  KELVS_PHONE_DISPLAY,
  KELVS_PHONE_TEL,
  KELVS_WHATSAPP_CHANNEL_URL,
  KELVS_WHATSAPP_URL,
  WhatsAppIcon,
} from './WhatsAppButton.tsx';

interface HomePageProps {
  recentJobs: JobListing[];
  remoteJobs: JobListing[];
  categories: CategoryItem[];
  demoModeEnabled: boolean;
  loading: boolean;
  onSearch: (query: string, location: string) => void;
  onSelectCategory: (categorySlug: string) => void;
  onSelectJob: (job: JobListing) => void;
  onToggleSave: (job: JobListing) => void;
  onNavigate: (view: AppView) => void;
}

const QUICK_SEARCH_ROLES = [
  'Website Development',
  'App Development',
  'Graphic Design',
  'UI/UX Designer',
  'Frontend Developer',
  'Data Analyst',
  'Cybersecurity Analyst',
  'Remote Assistant',
];

type RecentTab = 'all' | 'remote' | 'tech';

export function HomePage({
  recentJobs,
  remoteJobs,
  categories,
  demoModeEnabled,
  loading,
  onSearch,
  onSelectCategory,
  onSelectJob,
  onToggleSave,
  onNavigate,
}: HomePageProps) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [heroSplitImgFailed, setHeroSplitImgFailed] = useState(false);
  const [workflowImgFailed, setWorkflowImgFailed] = useState(false);
  const [recentTab, setRecentTab] = useState<RecentTab>('all');

  // Email Subscription Form State
  const [subEmail, setSubEmail] = useState('');
  const [subKeywords, setSubKeywords] = useState('');
  const [subWorkMode, setSubWorkMode] = useState('Any');
  const [subFrequency, setSubFrequency] = useState<'daily' | 'instant'>('daily');
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subMessage, setSubMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Website Reviews State
  const [reviews, setReviews] = useState<SiteReviewItem[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [reviewRecipientEmail, setReviewRecipientEmail] = useState('ebaluegbefodestiny@gmail.com');
  const [revName, setRevName] = useState('');
  const [revEmail, setRevEmail] = useState('');
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState('');
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [revStatus, setRevStatus] = useState<{
    type: 'success' | 'error';
    text: string;
    mailtoUrl?: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/reviews')
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            reviews?: SiteReviewItem[];
            averageRating?: number;
            totalReviews?: number;
            reviewRecipientEmail?: string;
          } | null
        ) => {
          if (data) {
            setReviews(data.reviews || []);
            setAverageRating(data.averageRating || 0);
            setTotalReviews(data.totalReviews || 0);
            if (data.reviewRecipientEmail) {
              setReviewRecipientEmail(data.reviewRecipientEmail);
            }
          }
        }
      )
      .catch(() => {});
  }, []);

  const displayedRecentJobs = useMemo(() => {
    if (recentTab === 'remote') {
      const filtered = recentJobs.filter(
        (j) => j.workArrangement.toLowerCase() === 'remote'
      );
      return (filtered.length > 0 ? filtered : remoteJobs).slice(0, 6);
    }
    if (recentTab === 'tech') {
      const filtered = recentJobs.filter((j) =>
        /software|frontend|backend|web|design|data|cyber|product|ui\/ux|tech/i.test(
          `${j.title} ${j.categoryName}`
        )
      );
      return (filtered.length > 0 ? filtered : recentJobs).slice(0, 6);
    }
    return recentJobs.slice(0, 6);
  }, [recentJobs, remoteJobs, recentTab]);

  const featuredSpotlightJob = recentJobs[0] ?? remoteJobs[0] ?? null;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setRevStatus(null);
    if (!revName.trim() || revComment.trim().length < 4) {
      setRevStatus({
        type: 'error',
        text: 'Please enter your name and a review message (at least 4 characters).',
      });
      return;
    }

    setRevSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerName: revName.trim(),
          reviewerEmail: revEmail.trim() || undefined,
          rating: revRating,
          comment: revComment.trim(),
        }),
      });
      const data = (await res.json()) as {
        review?: SiteReviewItem;
        emailStatus?: string;
        mailtoFallbackUrl?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setRevStatus({ type: 'error', text: data.error || 'Could not submit review.' });
      } else {
        if (data.review) {
          setReviews((prev) => {
            const next = [data.review!, ...prev];
            setTotalReviews(next.length);
            setAverageRating(
              Number((next.reduce((s, r) => s + r.rating, 0) / next.length).toFixed(1))
            );
            return next;
          });
        }
        setRevStatus({
          type: 'success',
          text: data.message || 'Thank you! Your review has been submitted.',
          mailtoUrl: data.emailStatus !== 'sent' ? data.mailtoFallbackUrl : undefined,
        });
        setRevName('');
        setRevEmail('');
        setRevRating(5);
        setRevComment('');
      }
    } catch {
      setRevStatus({ type: 'error', text: 'Network error while submitting your review.' });
    } finally {
      setRevSubmitting(false);
    }
  };

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query, location);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubMessage(null);
    if (!subEmail.trim()) {
      setSubMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setSubSubmitting(true);
    try {
      const res = await fetch('/api/alerts/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: subEmail.trim(),
          keywords: subKeywords.trim() || 'All Roles',
          workArrangement: subWorkMode,
          frequency: subFrequency,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setSubMessage({ type: 'error', text: data.error || 'Subscription failed.' });
      } else {
        setSubMessage({
          type: 'success',
          text: data.message || 'Job alert subscription saved.',
        });
        setSubEmail('');
        setSubKeywords('');
      }
    } catch {
      setSubMessage({ type: 'error', text: 'Network error while saving subscription.' });
    } finally {
      setSubSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* 1. Asymmetric Side-Aligned Hero Split */}
      <section className="relative bg-white dark:bg-slate-900 bg-[radial-gradient(ellipse_at_top_left,_rgba(29,78,216,0.06),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.12),transparent_58%)]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-stretch lg:gap-12">
            {/* Left Side: Editorial Headline, Natural Copy & Search Console */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <p className="text-xs sm:text-sm font-semibold tracking-wide text-blue-700 dark:text-blue-400">
                Centralised Job Discovery &amp; Aggregation
              </p>

              <h1 className="mt-3 font-display text-[clamp(2.25rem,3.9vw,3.4rem)] font-bold leading-[1.08] tracking-tight text-slate-900 dark:text-slate-50 [text-wrap:balance]">
                Find your next role without chasing ten job boards.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-[1.68] text-slate-600 dark:text-slate-300 sm:text-[17px]">
                Kelvs job search gathers open positions from employer career portals, RSS feeds, and
                global job boards into one fast workspace—complete with verified direct application
                links, public hiring emails, and zero cluttered redirects.
              </p>

              {/* Unified Search Console */}
              <form
                onSubmit={handleHeroSearch}
                className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950 p-2 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center gap-2.5 rounded-xl bg-white dark:bg-slate-900 px-3.5 py-3 border border-slate-200/80 dark:border-slate-800 focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-colors">
                    <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Role, skill, or company (e.g. Website Developer)"
                      aria-label="Search by job title, skills, or company"
                      className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl bg-white dark:bg-slate-900 px-3.5 py-3 border border-slate-200/80 dark:border-slate-800 focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-colors sm:w-48">
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City or Remote"
                      aria-label="Filter by location"
                      className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="rounded-xl bg-blue-700 dark:bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Search Jobs
                  </button>
                </div>
              </form>

              {/* Quick Role Links (Clean Unboxed Interactive Triggers) */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Popular:</span>
                {QUICK_SEARCH_ROLES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => onSearch(term, '')}
                    className="font-medium text-slate-600 dark:text-slate-300 underline-offset-4 hover:text-blue-700 dark:hover:text-blue-400 hover:underline transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>

              {demoModeEnabled && (
                <p className="mt-4 text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">Demo Mode Active:</span> Sample roles are clearly
                  labelled alongside live indexed vacancies.
                </p>
              )}
            </div>

            {/* Right Side: Stretched Editorial Visual + Live Featured Role Overlay */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="relative flex-1 min-h-[340px] lg:min-h-[430px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                {!heroSplitImgFailed ? (
                  <img
                    src="/src/assets/images/hero_split_workspace_1795049595335.jpg"
                    alt="Software engineers and product specialists reviewing live career openings"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroSplitImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-8 text-center">
                    <p className="font-display text-xl font-semibold text-white">
                      Centralised Job Discovery
                    </p>
                  </div>
                )}

                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent"
                  aria-hidden="true"
                />

                {featuredSpotlightJob && (
                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                    <p className="text-[11px] font-semibold tracking-wide text-blue-300">
                      {featuredSpotlightJob.isSampleData
                        ? 'Sample Highlight'
                        : 'Latest Indexed Role'}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelectJob(featuredSpotlightJob)}
                      className="mt-1 group flex w-full items-end justify-between gap-3 text-left cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="font-display text-lg font-semibold leading-snug text-white group-hover:text-blue-200 transition-colors truncate">
                          {featuredSpotlightJob.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-300 truncate">
                          {featuredSpotlightJob.companyName} · {featuredSpotlightJob.workArrangement}{' '}
                          · {featuredSpotlightJob.location}
                        </p>
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm group-hover:bg-blue-600 transition-colors">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Full-Width Grounded Capabilities Strip (Below Hero Split) */}
        <div className="border-y border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-y divide-slate-200 dark:divide-slate-800 sm:grid-cols-4 sm:divide-x sm:divide-y-0 px-4 sm:px-6 lg:px-8">
            <div className="py-5 pr-4 sm:px-5 first:pl-0">
              <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Live Search Federation
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Queries indexed roles and live remote boards together
              </p>
            </div>
            <div className="py-5 pl-4 sm:px-5">
              <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {categories.length || 15} Career Sectors
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Automatic role, skill, and arrangement classification
              </p>
            </div>
            <div className="py-5 pr-4 sm:px-5">
              <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Direct Employer Links
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Original application URLs and public contact emails
              </p>
            </div>
            <div className="py-5 pl-4 sm:px-5 last:pr-0">
              <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Instant WhatsApp &amp; Alerts
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Daily inbox digests and direct WhatsApp channel updates
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Recently Added Jobs (With Functional Tab Switching) */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              Recently Added Openings
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Freshly indexed opportunities from connected boards, RSS feeds, and direct employer
              submissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1"
              role="tablist"
              aria-label="Filter recent opportunities"
            >
              {[
                { id: 'all', label: 'All Recent' },
                { id: 'remote', label: 'Remote' },
                { id: 'tech', label: 'Tech & Design' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={recentTab === tab.id}
                  onClick={() => setRecentTab(tab.id as RecentTab)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    recentTab === tab.id
                      ? 'bg-slate-900 dark:bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('jobs')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Browse all jobs
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-52 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
              >
                <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="mt-3 h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800/70" />
                <div className="mt-6 h-12 rounded bg-slate-100 dark:bg-slate-800/70" />
              </div>
            ))}
          </div>
        ) : displayedRecentJobs.length === 0 ? (
          <div className="mt-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              No active job listings yet.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Search any role above or sync connected feeds from the Admin Dashboard.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {displayedRecentJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onSelect={onSelectJob}
                onToggleSave={onToggleSave}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Explore by Sector — Clean Editorial Index Directory */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                Browse by Sector
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Every collected listing is automatically mapped to one of 15 structured career
                categories for faster discovery.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('categories')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Full category index
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-8 grid gap-x-8 md:grid-cols-2 lg:grid-cols-3 border-t border-slate-200 dark:border-slate-800">
            {categories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => onSelectCategory(cat.slug)}
                className="group flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 py-4 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 px-2 -mx-2 rounded-lg cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="font-display text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors truncate">
                    {cat.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                    {cat.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>{cat.jobCount}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-all duration-150" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Remote Opportunities Showcase */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              Location-Flexible &amp; Remote Roles
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Distributed openings across software development, product design, support, and remote
              operations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('remote')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Explore all remote jobs
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {remoteJobs.slice(0, 3).map((job) => (
            <JobCard key={job.id} job={job} onSelect={onSelectJob} onToggleSave={onToggleSave} />
          ))}
        </div>
      </section>

      {/* 6. Editorial Walkthrough: How Aggregation Works */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-stretch lg:gap-12">
            <div className="lg:col-span-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 min-h-[300px]">
              {!workflowImgFailed ? (
                <img
                  src="/src/assets/images/career_workspace_editorial_1795041662171.jpg"
                  alt="Modern engineering and design workspace"
                  referrerPolicy="no-referrer"
                  onError={() => setWorkflowImgFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-100 dark:bg-slate-800 p-8 text-center">
                  <p className="font-display text-lg font-semibold text-slate-700 dark:text-slate-200">
                    Structured Aggregation Pipeline
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
                Built for Clarity &amp; Speed
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl [text-wrap:balance]">
                How Kelvs job search keeps listings accurate and verifiable.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Instead of reposting stale listings behind ad walls, the platform checks sources
                regularly, groups duplicate postings, and sends you straight to the employer.
              </p>

              <div className="mt-8 divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
                <div className="py-4">
                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    01. Continuous Multi-Source Collection
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Scheduled collectors and live search federation fetch vacancies from public
                    APIs, RSS feeds, and employer career endpoints.
                  </p>
                </div>

                <div className="py-4">
                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    02. Smart Role Grouping &amp; Deduplication
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Listings are matched by semantic job titles and deduplicated so the same role
                    appears once with alternate source links preserved.
                  </p>
                </div>

                <div className="pt-4">
                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    03. Direct Application Transparency
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Every listing displays the original job link, last verification time, and public
                    application email when provided.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Welcome Address from Kelvs & Direct WhatsApp Channels */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
              Welcome Address from Kelvs
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl [text-wrap:balance]">
              A direct word to every job seeker visiting today.
            </h2>
            <div className="space-y-4 text-sm leading-[1.75] text-slate-600 dark:text-slate-300 sm:text-base max-w-2xl">
              <p>
                Welcome to Kelvs job search. Looking for meaningful work should not mean chasing
                scattered links across dozens of websites, missing deadlines, or wondering whether a
                vacancy is still open.
              </p>
              <p>
                Our mission here is simple: gather real opportunities into one clear, searchable
                space so you can focus on preparing your CV, showcasing your skills, and applying
                directly with confidence. Whether you are taking your first step into the
                workforce, switching into a new trade or tech role, or pursuing your next senior
                position, stay consistent and never hesitate to reach out.
              </p>
            </div>
            <p className="pt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              — Kelvs, Founder of Kelvs job search
            </p>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 space-y-5">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                Connect Directly on WhatsApp
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Have questions about a role, want to share a vacancy, or prefer daily role alerts
                straight on WhatsApp? Reach out immediately below.
              </p>
            </div>

            <div className="space-y-3">
              <a
                href={KELVS_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#15803d] px-5 py-3 text-sm font-semibold text-white hover:bg-[#166534] transition-colors whitespace-nowrap"
              >
                <WhatsAppIcon className="h-5 w-5 shrink-0" />
                Chat on WhatsApp ({KELVS_PHONE_DISPLAY})
              </a>

              <a
                href={KELVS_WHATSAPP_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <span className="inline-flex items-center gap-2.5">
                  <WhatsAppIcon className="h-4 w-4 shrink-0 text-[#15803d] dark:text-[#4ade80]" />
                  <span>Join Our WhatsApp Channel</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              </a>

              <a
                href={KELVS_PHONE_TEL}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Phone className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
                  <span>Call Direct</span>
                </span>
                <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {KELVS_PHONE_DISPLAY}
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Email Job Alerts Band */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                <Mail className="h-4 w-4" />
                <span>Automated Job Alerts</span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Get matching jobs delivered to your inbox.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Receive instant alerts when a new match arrives or a concise daily digest filtered by
                role and remote arrangement.
              </p>
            </div>

            <form onSubmit={handleSubscribe} className="lg:col-span-7 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="email"
                  required
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address for job alerts"
                  className="h-11 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none"
                />
                <input
                  type="text"
                  value={subKeywords}
                  onChange={(e) => setSubKeywords(e.target.value)}
                  placeholder="Role (e.g. Website Developer)"
                  aria-label="Job role or keywords"
                  className="h-11 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  value={subWorkMode}
                  onChange={(e) => setSubWorkMode(e.target.value)}
                  aria-label="Work arrangement preference"
                  className="h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 px-3.5 text-sm text-slate-700 dark:text-slate-200 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="Any">Any Arrangement</option>
                  <option value="Remote">Remote Only</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Onsite">Onsite</option>
                </select>

                <select
                  value={subFrequency}
                  onChange={(e) =>
                    setSubFrequency(e.target.value === 'instant' ? 'instant' : 'daily')
                  }
                  aria-label="Alert frequency"
                  className="h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 px-3.5 text-sm text-slate-700 dark:text-slate-200 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="daily">Daily Digest</option>
                  <option value="instant">Instant Notification</option>
                </select>

                <button
                  type="submit"
                  disabled={subSubmitting}
                  className="h-11 flex-1 rounded-xl bg-blue-700 dark:bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {subSubmitting ? 'Subscribing...' : 'Subscribe to Alerts'}
                </button>
              </div>

              {subMessage && (
                <p
                  className={`text-xs font-medium ${
                    subMessage.type === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {subMessage.text}
                </p>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* 9. Website Reviews & Feedback (Forwarded to Kelvs Gmail) */}
      <section
        id="reviews"
        className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
            <div className="lg:col-span-6 space-y-5">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  Website Reviews &amp; Feedback
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Share your experience with Kelvs job search. Reviews display here and forward
                  directly to{' '}
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {reviewRecipientEmail}
                  </span>
                  .
                </p>
              </div>

              <div className="flex items-center gap-3 border-y border-slate-200 dark:border-slate-800 py-3">
                <div className="flex items-center gap-1 text-amber-500" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= Math.round(averageRating || 5)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {totalReviews > 0 ? `${averageRating} / 5.0` : 'No reviews yet'}
                </p>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
                </p>
              </div>

              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Be the first visitor to leave a review for Kelvs job search.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-80 overflow-y-auto pr-2">
                  {reviews.slice(0, 8).map((rev) => (
                    <div key={rev.id} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {rev.reviewerName}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                          {new Date(rev.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3.5 w-3.5 ${
                              star <= rev.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-200 dark:text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {rev.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmitReview}
              className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 space-y-4"
            >
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  Write a Review
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tell Kelvs what helped your search or which job categories you want more of.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={revName}
                    onChange={(e) => setRevName(e.target.value)}
                    placeholder="e.g. Chidi Okafor"
                    className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Email (optional)
                  </label>
                  <input
                    type="email"
                    value={revEmail}
                    onChange={(e) => setRevEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Rating
                </span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRevRating(star)}
                      aria-label={`Rate ${star} out of 5 stars`}
                      className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Star
                        className={`h-5 w-5 transition-colors ${
                          star <= revRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300 dark:text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                    {revRating} / 5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Your Review
                </label>
                <textarea
                  required
                  rows={3}
                  value={revComment}
                  onChange={(e) => setRevComment(e.target.value)}
                  placeholder="Share your thoughts about Kelvs job search..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={revSubmitting}
                className="h-11 w-full rounded-xl bg-blue-700 dark:bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {revSubmitting ? 'Sending Review...' : 'Submit Review'}
              </button>

              {revStatus && (
                <div
                  className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                    revStatus.type === 'success'
                      ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                      : 'border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                  }`}
                >
                  <p className="font-medium">{revStatus.text}</p>
                  {revStatus.mailtoUrl && (
                    <a
                      href={revStatus.mailtoUrl}
                      className="mt-1.5 inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      Send directly from your email app to {reviewRecipientEmail}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* 10. Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-md">
              <p className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                Kelvs job search
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Centralised vacancy discovery platform. Original employer links and attribution are
                preserved on every external listing.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                <a
                  href={KELVS_PHONE_TEL}
                  className="inline-flex items-center gap-1.5 hover:text-blue-700 dark:hover:text-blue-400 tabular-nums"
                >
                  <Phone className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
                  {KELVS_PHONE_DISPLAY}
                </a>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <a
                  href={KELVS_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#15803d] dark:text-[#4ade80] hover:underline"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  WhatsApp Direct
                </a>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <a
                  href={KELVS_WHATSAPP_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400 hover:underline"
                >
                  WhatsApp Channel
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600 dark:text-slate-300">
              <button
                type="button"
                onClick={() => onNavigate('jobs')}
                className="hover:text-slate-900 dark:hover:text-slate-50 cursor-pointer whitespace-nowrap"
              >
                Browse Jobs
              </button>
              <button
                type="button"
                onClick={() => onNavigate('categories')}
                className="hover:text-slate-900 dark:hover:text-slate-50 cursor-pointer whitespace-nowrap"
              >
                Categories
              </button>
              <button
                type="button"
                onClick={() => onNavigate('remote')}
                className="hover:text-slate-900 dark:hover:text-slate-50 cursor-pointer whitespace-nowrap"
              >
                Remote Jobs
              </button>
              <button
                type="button"
                onClick={() => onNavigate('alerts')}
                className="hover:text-slate-900 dark:hover:text-slate-50 cursor-pointer whitespace-nowrap"
              >
                Job Alerts
              </button>
            </div>
          </div>
          <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6 text-xs text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} Kelvs job search. Built for transparent job discovery.
          </div>
        </div>
      </footer>
    </div>
  );
}

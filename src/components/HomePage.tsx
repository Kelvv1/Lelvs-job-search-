import React, { useEffect, useState } from 'react';
import {
  Search,
  MapPin,
  ArrowRight,
  Globe,
  Layers,
  CheckCircle,
  Mail,
  Phone,
  ExternalLink,
  Star,
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

const POPULAR_SEARCHES = [
  'Website Development',
  'App Development',
  'Graphic Design',
  'Frontend Developer',
  'Backend Developer',
  'UI/UX Designer',
  'Data Analyst',
  'Cybersecurity Analyst',
  'Digital Marketer',
  'Accountant',
  'Customer Support',
  'Remote Assistant',
];

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
  const [heroImgFailed, setHeroImgFailed] = useState(false);

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
      {/* 2, 3, 4, 5. Hero Section + Supporting Text + Search Bar + Popular Searches */}
      <section className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl [text-wrap:balance]">
              Find Your Next Opportunity in One Place.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              Kelvs job search continuously collects, categorises, and verifies open positions from
              authorised job boards, RSS feeds, and employer career portals—so you can search across
              sources without missing direct application instructions.
            </p>
          </div>

          {/* Prominent Multi-Field Search Bar */}
          <form
            onSubmit={handleHeroSearch}
            className="mx-auto mt-9 max-w-4xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 shadow-sm"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2.5 focus-within:bg-slate-50 dark:focus-within:bg-slate-900">
                <Search className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Job title, skills, or company (e.g. Website Developer)"
                  aria-label="Search by job title, skills, or company"
                  className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              <div className="hidden h-7 w-px bg-slate-200 dark:bg-slate-800 md:block" aria-hidden="true" />

              <div className="flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2.5 focus-within:bg-slate-50 dark:focus-within:bg-slate-900 md:max-w-[260px]">
                <MapPin className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, country, or Remote"
                  aria-label="Filter by location"
                  className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="rounded-lg bg-blue-700 dark:bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Search Jobs
              </button>
            </div>
          </form>

          {/* 5. Popular Job Searches */}
          <div className="mx-auto mt-7 max-w-4xl">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Popular searches:</span>
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onSearch(term, '')}
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {demoModeEnabled && (
            <div className="mx-auto mt-6 max-w-3xl rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/40 px-4 py-2.5 text-center text-xs text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Demo Mode Active:</span> Sample listings are clearly
              labelled for testing search and workflows alongside any manually published or external
              vacancies.
            </div>
          )}
        </div>
      </section>

      {/* 6. Recently Added Jobs */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Recently Added Jobs
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Latest active opportunities indexed from connected sources and direct listings.
            </p>
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

        {loading ? (
          <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-52 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
              >
                <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="mt-3 h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800/70" />
                <div className="mt-6 h-12 rounded bg-slate-100 dark:bg-slate-800/70" />
              </div>
            ))}
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="mt-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No active job listings yet.</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Administrators can connect sources and run a sync from the Admin Dashboard.
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {recentJobs.slice(0, 9).map((job) => (
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

      {/* 7. Browse by Category */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Browse by Category
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Every incoming listing is automatically classified across 15 structured sectors.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('categories')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              View all categories
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-7 grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {categories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => onSelectCategory(cat.slug)}
                className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-4 text-left transition-all duration-150 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {cat.name}
                </span>
                <span className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {cat.jobCount} {cat.jobCount === 1 ? 'open role' : 'open roles'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Remote Opportunities Section */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Remote Opportunities
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Location-flexible roles across software, design, support, and operations.
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

        <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {remoteJobs.slice(0, 3).map((job) => (
            <JobCard key={job.id} job={job} onSelect={onSelectJob} onToggleSave={onToggleSave} />
          ))}
        </div>
      </section>

      {/* 9. How the Platform Works */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                How Kelvs job search Aggregates Opportunities
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Built on an automated aggregation pipeline that respects source attribution,
                eliminates duplicate postings, and removes expired vacancies automatically.
              </p>

              <div className="mt-8 space-y-6">
                <div className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                      01. Authorised Source Collection
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Scheduled collectors query public job APIs, RSS feeds, and employer career
                      endpoints every few hours.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                      02. Categorisation & Duplicate Grouping
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Incoming vacancies are mapped to 15 job sectors, matched by semantic role
                      keywords, and deduplicated across multiple boards.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                      03. Direct Application Transparency
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Every listing preserves the original source link and verified public
                      application email—without inventing contact details.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/career_workspace_editorial_1795041662171.jpg"
                  alt="Modern engineering and design workspace"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="h-full min-h-[280px] w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center bg-slate-100 dark:bg-slate-800 p-8 text-center">
                  <p className="font-display text-lg font-semibold text-slate-700 dark:text-slate-200">
                    Centralised Career Discovery
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Founder Speech & Direct WhatsApp Community Section */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
                Welcome Address from Kelvs
              </p>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl [text-wrap:balance]">
                A Direct Word to Every Job Seeker Visiting Today
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
                <p>
                  Welcome to Kelvs job search. Looking for meaningful work should not mean chasing
                  scattered links across dozens of websites, missing deadlines, or wondering whether
                  a vacancy is still open.
                </p>
                <p>
                  Our mission here is simple: gather real opportunities into one clear, searchable
                  space so you can focus on preparing your CV, showcasing your skills, and applying
                  directly with confidence. Whether you are taking your first step into the
                  workforce, switching into a new trade or tech role, or pursuing your next senior
                  position, stay consistent, keep improving your craft, and never hesitate to reach
                  out. You do not have to walk your job search alone.
                </p>
              </div>
              <p className="pt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                — Kelvs, Founder of Kelvs job search
              </p>
            </div>

            <div className="lg:col-span-5 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  Reach Kelvs Directly &amp; Stay Updated
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Have questions about an opening, want to share a vacancy, or prefer daily role
                  updates straight on WhatsApp? Connect immediately below.
                </p>
              </div>

              <div className="space-y-3">
                <a
                  href={KELVS_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#15803d] px-5 py-3 text-sm font-semibold text-white hover:bg-[#166534] transition-colors whitespace-nowrap"
                >
                  <WhatsAppIcon className="h-5 w-5 shrink-0" />
                  Chat on WhatsApp ({KELVS_PHONE_DISPLAY})
                </a>

                <a
                  href={KELVS_WHATSAPP_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <WhatsAppIcon className="h-4 w-4 shrink-0 text-[#15803d] dark:text-[#4ade80]" />
                    <span>Join Our WhatsApp Channel</span>
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                </a>

                <a
                  href={KELVS_PHONE_TEL}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
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
        </div>
      </section>

      {/* 10. Email Subscription Section */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                <Mail className="h-4 w-4" />
                <span>Automated Job Alerts</span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Get New Matching Jobs Delivered to Your Inbox
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Choose instant alerts when our collector discovers a match, or a concise daily
                summary filtered by role and remote preference.
              </p>
            </div>

            <form onSubmit={handleSubscribe} className="lg:col-span-6 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="email"
                  required
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address for job alerts"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                />
                <input
                  type="text"
                  value={subKeywords}
                  onChange={(e) => setSubKeywords(e.target.value)}
                  placeholder="Role (e.g. Website Developer)"
                  aria-label="Job role or keywords"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  value={subWorkMode}
                  onChange={(e) => setSubWorkMode(e.target.value)}
                  aria-label="Work arrangement preference"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
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
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="daily">Daily Digest</option>
                  <option value="instant">Instant Notification</option>
                </select>

                <button
                  type="submit"
                  disabled={subSubmitting}
                  className="flex-1 rounded-lg bg-blue-700 dark:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
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

      {/* 11. Website Reviews Section (Bottom of Site, Forwards to Kelvs Gmail) */}
      <section id="reviews" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-6 space-y-5">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  Website Reviews &amp; Feedback
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                  Share your experience with Kelvs job search. Reviews appear below and are routed
                  to <span className="font-medium text-slate-800 dark:text-slate-100">{reviewRecipientEmail}</span>.
                </p>
              </div>

              <div className="flex items-center gap-3 border-y border-slate-100 dark:border-slate-800 py-3">
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
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto pr-1">
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
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmitReview}
              className="lg:col-span-6 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0"
            >
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  Write a Review
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tell Kelvs what helped you or what role categories you want more of.
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
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
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
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Rating</span>
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
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={revSubmitting}
                className="w-full rounded-lg bg-blue-700 dark:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {revSubmitting ? 'Sending Review...' : 'Submit Review'}
              </button>

              {revStatus && (
                <div
                  className={`rounded-lg border px-3.5 py-2.5 text-xs ${
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

      {/* 12. Professional Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-md">
              <p className="font-display text-base font-bold text-slate-900 dark:text-slate-50">Kelvs job search</p>
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

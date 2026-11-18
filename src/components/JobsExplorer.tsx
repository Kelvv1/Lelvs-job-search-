import React, { useEffect, useState } from 'react';
import { Search, MapPin, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { CategoryItem, JobListing } from '../types.ts';
import { JobCard } from './JobCard.tsx';

export interface SearchFiltersState {
  q: string;
  location: string;
  category: string;
  workArrangement: string;
  employmentType: string;
  experienceLevel: string;
  datePosted: string;
  salaryMin: string;
  sort: string;
  origin: string;
  page: number;
}

interface JobsExplorerProps {
  filters: SearchFiltersState;
  categories: CategoryItem[];
  onChangeFilters: (next: Partial<SearchFiltersState>) => void;
  onResetFilters: () => void;
  onSelectJob: (job: JobListing) => void;
  onToggleSave: (job: JobListing) => void;
  refreshTrigger: number;
}

export function JobsExplorer({
  filters,
  categories,
  onChangeFilters,
  onResetFilters,
  onSelectJob,
  onToggleSave,
  refreshTrigger,
}: JobsExplorerProps) {
  const { authFetch } = useAuth();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedTerms, setExpandedTerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [draftQuery, setDraftQuery] = useState(filters.q);
  const [draftLocation, setDraftLocation] = useState(filters.location);

  useEffect(() => {
    setDraftQuery(filters.q);
    setDraftLocation(filters.location);
  }, [filters.q, filters.location]);

  useEffect(() => {
    let active = true;
    async function runSearch() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set('q', filters.q);
        if (filters.location) params.set('location', filters.location);
        if (filters.category) params.set('category', filters.category);
        if (filters.workArrangement && filters.workArrangement !== 'All') {
          params.set('workArrangement', filters.workArrangement);
        }
        if (filters.employmentType && filters.employmentType !== 'All') {
          params.set('employmentType', filters.employmentType);
        }
        if (filters.experienceLevel && filters.experienceLevel !== 'All') {
          params.set('experienceLevel', filters.experienceLevel);
        }
        if (filters.datePosted) params.set('datePosted', filters.datePosted);
        if (filters.salaryMin) params.set('salaryMin', filters.salaryMin);
        if (filters.sort) params.set('sort', filters.sort);
        if (filters.origin && filters.origin !== 'all') params.set('origin', filters.origin);
        params.set('page', String(filters.page));
        params.set('limit', '60');

        const res = await authFetch(`/api/jobs?${params.toString()}`);
        if (!res.ok) throw new Error('Unable to load job results.');
        const data = (await res.json()) as {
          jobs: JobListing[];
          total: number;
          totalPages: number;
          expandedTerms: string[];
        };

        if (active) {
          setJobs(data.jobs);
          setTotal(data.total);
          setTotalPages(data.totalPages);
          setExpandedTerms(data.expandedTerms || []);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Search failed.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    runSearch();
    return () => {
      active = false;
    };
  }, [filters, authFetch, refreshTrigger]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChangeFilters({ q: draftQuery, location: draftLocation, page: 1 });
  };

  const renderFiltersContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-50">Filter Vacancies</h2>
        <button
          type="button"
          onClick={onResetFilters}
          className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
        >
          Reset all
        </button>
      </div>

      {/* Work Arrangement */}
      <div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Work Arrangement</p>
        <div className="grid grid-cols-2 gap-1.5">
          {['All', 'Remote', 'Hybrid', 'Onsite'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChangeFilters({ workArrangement: mode, page: 1 })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                filters.workArrangement === mode
                  ? 'border-blue-700 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Employment Type */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="filter-emp-type">
          Employment Type
        </label>
        <select
          id="filter-emp-type"
          value={filters.employmentType}
          onChange={(e) => onChangeFilters({ employmentType: e.target.value, page: 1 })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
        >
          <option value="All">All Types</option>
          <option value="Full-time">Full-time</option>
          <option value="Part-time">Part-time</option>
          <option value="Contract">Contract</option>
          <option value="Internship">Internship</option>
        </select>
      </div>

      {/* Experience Level */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="filter-exp-level">
          Experience Level
        </label>
        <select
          id="filter-exp-level"
          value={filters.experienceLevel}
          onChange={(e) => onChangeFilters({ experienceLevel: e.target.value, page: 1 })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
        >
          <option value="All">All Levels</option>
          <option value="Entry-level">Entry-level</option>
          <option value="Graduate">Graduate Opportunities</option>
          <option value="Mid-level">Mid-level</option>
          <option value="Senior">Senior / Experienced</option>
          <option value="Lead">Lead / Principal</option>
        </select>
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="filter-category">
          Job Category
        </label>
        <select
          id="filter-category"
          value={filters.category}
          onChange={(e) => onChangeFilters({ category: e.target.value, page: 1 })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.name} ({cat.jobCount})
            </option>
          ))}
        </select>
      </div>

      {/* Date Posted */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="filter-date">
          Date Posted
        </label>
        <select
          id="filter-date"
          value={filters.datePosted}
          onChange={(e) => onChangeFilters({ datePosted: e.target.value, page: 1 })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
        >
          <option value="">Any Time</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="14d">Last 14 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Minimum Salary */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="filter-salary">
          Minimum Annual Salary
        </label>
        <select
          id="filter-salary"
          value={filters.salaryMin}
          onChange={(e) => onChangeFilters({ salaryMin: e.target.value, page: 1 })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
        >
          <option value="">Any Salary</option>
          <option value="30000">30,000+</option>
          <option value="50000">50,000+</option>
          <option value="75000">75,000+</option>
          <option value="100000">100,000+</option>
        </select>
      </div>

      {/* Source Origin */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="filter-origin">
          Listing Origin
        </label>
        <select
          id="filter-origin"
          value={filters.origin}
          onChange={(e) => onChangeFilters({ origin: e.target.value, page: 1 })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
        >
          <option value="all">All Active Listings</option>
          <option value="live">Live External Sources Only</option>
          <option value="sample">Sample Reference Listings</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xs"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 focus-within:bg-slate-50 dark:focus-within:bg-slate-800/70">
            <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              placeholder="Search role, keywords, skills, or company..."
              aria-label="Job search query"
              className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-800 md:block" />
          <div className="flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 focus-within:bg-slate-50 dark:focus-within:bg-slate-800/70 md:max-w-[240px]">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={draftLocation}
              onChange={(e) => setDraftLocation(e.target.value)}
              placeholder="Location or Remote"
              aria-label="Location filter"
              className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-700 dark:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Update Search
          </button>
        </div>
      </form>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            {renderFiltersContent()}
          </div>
        </aside>

        {/* Results Column */}
        <main className="lg:col-span-9">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {loading ? 'Searching...' : `${total} ${total === 1 ? 'opportunity' : 'opportunities'} found`}
              </p>
              {filters.q && expandedTerms.length > 1 && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Matching related roles & skills: {expandedTerms.slice(0, 6).join(', ')}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => onChangeFilters({ datePosted: '', page: 1 })}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    !filters.datePosted
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  All Listed
                </button>
                <button
                  type="button"
                  onClick={() => onChangeFilters({ datePosted: '7d', page: 1 })}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    filters.datePosted === '7d'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Last 7 Days
                </button>
              </div>

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 lg:hidden cursor-pointer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
              </button>

              <label className="text-xs text-slate-500 dark:text-slate-400" htmlFor="sort-select">
                Sort by
              </label>
              <select
                id="sort-select"
                value={filters.sort}
                onChange={(e) => onChangeFilters({ sort: e.target.value, page: 1 })}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
              >
                <option value="relevant">Most relevant</option>
                <option value="recent">Most recent</option>
                <option value="deadline">Application deadline</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-48 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
                >
                  <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800/70" />
                  <div className="mt-6 h-12 rounded bg-slate-100 dark:bg-slate-800/70" />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                No matching vacancies found
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Try broadening your location, removing strict filters, or searching a related role.
              </p>
              <button
                type="button"
                onClick={onResetFilters}
                className="mt-4 rounded-lg bg-blue-700 dark:bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onSelect={onSelectJob}
                    onToggleSave={onToggleSave}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-5">
                  <button
                    type="button"
                    disabled={filters.page <= 1}
                    onClick={() => onChangeFilters({ page: filters.page - 1 })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 tabular-nums">
                    Page {filters.page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={filters.page >= totalPages}
                    onClick={() => onChangeFilters({ page: filters.page + 1 })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Filter Drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 dark:bg-slate-950/75 lg:hidden">
          <div className="h-full w-full max-w-xs overflow-y-auto bg-white dark:bg-slate-900 p-5 shadow-xl border-l border-slate-200 dark:border-slate-800">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">Filters</span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderFiltersContent()}
          </div>
        </div>
      )}
    </div>
  );
}

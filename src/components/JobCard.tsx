import { useState } from 'react';
import { Bookmark, Building2, CheckCircle2 } from 'lucide-react';
import { JobListing } from '../types.ts';

interface JobCardProps {
  job: JobListing;
  onSelect: (job: JobListing) => void;
  onToggleSave: (job: JobListing) => void;
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function JobCard({ job, onSelect, onToggleSave }: JobCardProps) {
  const [logoError, setLogoError] = useState(false);

  const initials = job.companyName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  const excerpt = job.description.replace(/\n+/g, ' ').trim().slice(0, 145);

  return (
    <article className="group flex flex-col justify-between rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md dark:hover:shadow-slate-950/50">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {job.companyLogo && !logoError ? (
                <img
                  src={job.companyLogo}
                  alt={`${job.companyName} logo`}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="h-full w-full object-contain p-1"
                />
              ) : initials ? (
                <span>{initials}</span>
              ) : (
                <Building2 className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              )}
            </div>

            <div className="min-w-0">
              {job.isSampleData && (
                <p className="mb-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  Sample Listing (Demo Data)
                </p>
              )}
              <button
                type="button"
                onClick={() => onSelect(job)}
                className="text-left font-display text-[16px] leading-snug font-semibold text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors line-clamp-2 cursor-pointer"
              >
                {job.title}
              </button>
              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300 truncate">
                {job.companyName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(job);
            }}
            aria-label={job.isSaved ? 'Remove from saved jobs' : 'Save job'}
            title={job.isSaved ? 'Saved' : 'Save job'}
            className={`shrink-0 rounded-lg p-2 transition-colors cursor-pointer ${
              job.isSaved
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${job.isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Clean Unboxed Metadata Line (Zero-Pill Discipline) */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          <span>{job.location}</span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{job.workArrangement}</span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
          <span>{job.employmentType}</span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
          <span className="tabular-nums">{formatRelativeDate(job.publishedAt)}</span>
          {job.salaryText && (
            <>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{job.salaryText}</span>
            </>
          )}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-2">
          {excerpt}{job.description.length > 145 ? '…' : ''}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3.5 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 min-w-0">
          {!job.isSampleData && job.status === 'verified' && (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="truncate">
            {job.isSampleData ? 'Sample Reference Listing' : `Source: ${job.sourceName}`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onSelect(job)}
          className="font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 whitespace-nowrap shrink-0 cursor-pointer"
        >
          View details →
        </button>
      </div>
    </article>
  );
}

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { JobListing } from '../types.ts';
import { JobCard } from './JobCard.tsx';

interface JobDetailViewProps {
  jobId: number;
  initialJob?: JobListing | null;
  onBack: () => void;
  onSelectJob: (job: JobListing) => void;
  onToggleSave: (job: JobListing) => void;
}

export function JobDetailView({
  jobId,
  initialJob = null,
  onBack,
  onSelectJob,
  onToggleSave,
}: JobDetailViewProps) {
  const { authFetch } = useAuth();
  const [job, setJob] = useState<JobListing | null>(initialJob);
  const [relatedJobs, setRelatedJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(!initialJob);
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    let active = true;
    setJob(initialJob);
    setLoading(!initialJob);
    setError(null);
    setLogoError(false);

    async function loadDetail() {
      try {
        const res = await authFetch(`/api/jobs/${jobId}`);
        if (!res.ok) {
          if (!initialJob && active) throw new Error('Unable to load job details.');
          return;
        }
        const data = (await res.json()) as { job: JobListing; relatedJobs: JobListing[] };
        if (active) {
          setJob(data.job);
          setRelatedJobs(data.relatedJobs || []);
        }
      } catch (err: unknown) {
        if (active && !initialJob) {
          setError(err instanceof Error ? err.message : 'Unable to load listing.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDetail();
    return () => {
      active = false;
    };
  }, [jobId, initialJob, authFetch]);

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2200);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = email;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2200);
      } catch {
        // Fallback ignored
      }
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{error || 'Job listing not found.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to job search
        </button>
      </div>
    );
  }

  const publishedFormatted = new Date(job.publishedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const verifiedFormatted = new Date(job.lastVerifiedAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const deadlineFormatted = job.deadlineAt
    ? new Date(job.deadlineAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-50 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to listings
      </button>

      <div className="mt-6 grid gap-8 lg:grid-cols-12">
        {/* Main Column: Overview, Description, Requirements */}
        <div className="lg:col-span-8 space-y-6">
          {/* Job Overview Card */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  {job.companyLogo && !logoError ? (
                    <img
                      src={job.companyLogo}
                      alt={`${job.companyName} logo`}
                      referrerPolicy="no-referrer"
                      onError={() => setLogoError(true)}
                      className="h-full w-full object-contain p-1.5"
                    />
                  ) : (
                    <Building2 className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                  )}
                </div>

                <div>
                  {job.isSampleData && (
                    <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Sample Listing (Demo Data)
                    </p>
                  )}
                  <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                    {job.title}
                  </h1>
                  <p className="mt-1 text-base font-medium text-slate-700 dark:text-slate-300">{job.companyName}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await onToggleSave(job);
                  setJob((prev) => (prev ? { ...prev, isSaved: !prev.isSaved } : prev));
                }}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  job.isSaved
                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Bookmark className={`h-4 w-4 ${job.isSaved ? 'fill-current' : ''}`} />
                {job.isSaved ? 'Saved' : 'Save Job'}
              </button>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-6 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Location</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{job.location}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Work Arrangement</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{job.workArrangement}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Employment Type</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{job.employmentType}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Experience Level</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{job.experienceLevel}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Category</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{job.categoryName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Date Published</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {publishedFormatted}
                </dd>
              </div>
              {job.salaryText && (
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Compensation</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {job.salaryText}
                  </dd>
                </div>
              )}
              {deadlineFormatted && (
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Application Deadline</dt>
                  <dd className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                    {deadlineFormatted}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Job Description */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">Job Description</h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
              {job.description}
            </div>
          </section>

          {/* Requirements & Skills */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Qualifications & Skills
            </h2>
            <div className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
              {job.requirements}
            </div>

            {job.skills && job.skills.length > 0 && (
              <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Extracted Key Skills</p>
                <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {job.skills.join('  ·  ')}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar: Application Information & Source Verification */}
        <aside className="lg:col-span-4 space-y-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Application Information
            </h2>

            {job.isSampleData ? (
              <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-semibold">Sample Listing (Demo Data)</p>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  This is a sample reference listing for testing search, filtering, and job layout
                  workflows. It is not a live vacancy, and no fake employer email or external
                  application link has been generated.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  When an administrator adds a real job manually or connects an external source,
                  this panel displays the verified application email with a Copy Email Address
                  button and direct Apply Now link.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {job.applicationEmail && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <Mail className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
                      <span>Public Application Email</span>
                    </div>
                    <p className="mt-1.5 break-all font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                      {job.applicationEmail}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyEmail(job.applicationEmail!)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        {copiedEmail ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            Email Address Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Email Address
                          </>
                        )}
                      </button>
                      <a
                        href={`mailto:${job.applicationEmail}?subject=${encodeURIComponent(`Application: ${job.title}`)}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Compose Application Email
                      </a>
                    </div>
                  </div>
                )}

                {job.applicationUrl && (
                  <a
                    href={job.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 dark:bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors"
                  >
                    Apply Now
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}

                {!job.applicationEmail && job.applicationUrl && (
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    No public email address was provided by the employer. Applications must be
                    submitted through the original application portal linked above.
                  </p>
                )}

                {job.applicationInstructions && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Employer Instructions</p>
                    <p className="mt-1">{job.applicationInstructions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Source & Verification Metadata */}
            <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Verification status</span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100 capitalize">
                  {job.status === 'verified' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  )}
                  {job.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Original source</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 text-right">{job.sourceName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Last verified</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums text-right">
                  {verifiedFormatted}
                </span>
              </div>
            </div>

            {job.alternateSources && job.alternateSources.length > 0 && (
              <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Also discovered on ({job.alternateSources.length})
                </p>
                <ul className="mt-2 space-y-1.5">
                  {job.alternateSources.map((alt, idx) => (
                    <li key={idx} className="text-xs">
                      <a
                        href={alt.applicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline"
                      >
                        {alt.sourceName}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Related Jobs */}
      {relatedJobs.length > 0 && (
        <section className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-10">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
            Related Opportunities in {job.categoryName}
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {relatedJobs.map((rel) => (
              <JobCard
                key={rel.id}
                job={rel}
                onSelect={onSelectJob}
                onToggleSave={onToggleSave}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

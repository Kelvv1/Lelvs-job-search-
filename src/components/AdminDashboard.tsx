import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Edit3,
  Send,
  AlertTriangle,
  Plug,
  Settings,
  Users,
  Briefcase,
  LayoutDashboard,
  Mail,
  Info,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  CategoryItem,
  JobListing,
  JobSourceItem,
  NotificationLogItem,
  PlatformSettingsItem,
  SiteReviewItem,
  SyncLogItem,
} from '../types.ts';

interface AdminDashboardProps {
  categories: CategoryItem[];
  onDataChanged: () => void;
}

type AdminTab = 'overview' | 'jobs' | 'integrations' | 'automation' | 'reviews' | 'users';

export function AdminDashboard({ categories, onDataChanged }: AdminDashboardProps) {
  const { dbUser, authFetch } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');

  const [stats, setStats] = useState({
    totalJobs: 0,
    newToday: 0,
    activeJobs: 0,
    expiredJobs: 0,
    totalUsers: 0,
    connectedSources: 0,
  });
  const [syncLogs, setSyncLogs] = useState<SyncLogItem[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLogItem[]>([]);
  const [adminJobs, setAdminJobs] = useState<JobListing[]>([]);
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [jobSearch, setJobSearch] = useState('');
  const [sources, setSources] = useState<JobSourceItem[]>([]);
  const [settings, setSettings] = useState<PlatformSettingsItem | null>(null);
  const [credentialsStatus, setCredentialsStatus] = useState({
    hasResendKey: false,
    hasSmtpCredentials: false,
    hasAdzunaCredentials: false,
  });
  const [registeredUsers, setRegisteredUsers] = useState<
    Array<{ id: number; email: string; displayName: string | null; role: string; createdAt: string }>
  >([]);
  const [adminReviews, setAdminReviews] = useState<SiteReviewItem[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [banner, setBanner] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  // Add / Edit Job Modal
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobListing | null>(null);
  const [jobForm, setJobForm] = useState({
    title: '',
    companyName: '',
    categoryId: '',
    location: '',
    workArrangement: 'Remote',
    employmentType: 'Full-time',
    experienceLevel: 'Mid-level',
    salaryText: '',
    applicationEmail: '',
    applicationUrl: '',
    applicationInstructions: '',
    description: '',
    requirements: '',
    skills: '',
    status: 'verified',
    isSampleData: false,
  });

  // Add Source Form
  const [newSource, setNewSource] = useState({
    name: '',
    sourceType: 'rss_feed',
    endpointUrl: '',
    apiKeyEnvVar: '',
  });

  const loadOverview = useCallback(async () => {
    const res = await authFetch('/api/admin/overview');
    if (res.ok) {
      const data = (await res.json()) as {
        stats: typeof stats;
        recentSyncLogs: SyncLogItem[];
        recentNotifications: NotificationLogItem[];
      };
      setStats(data.stats);
      setSyncLogs(data.recentSyncLogs);
      setNotificationLogs(data.recentNotifications);
    }
  }, [authFetch]);

  const loadAdminJobs = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('status', jobStatusFilter);
    if (jobSearch) params.set('q', jobSearch);
    const res = await authFetch(`/api/admin/jobs?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { jobs: JobListing[] };
      setAdminJobs(data.jobs);
    }
  }, [authFetch, jobStatusFilter, jobSearch]);

  const loadSources = useCallback(async () => {
    const res = await authFetch('/api/admin/sources');
    if (res.ok) {
      const data = (await res.json()) as { sources: JobSourceItem[] };
      setSources(data.sources);
    }
  }, [authFetch]);

  const loadSettings = useCallback(async () => {
    const res = await authFetch('/api/admin/settings');
    if (res.ok) {
      const data = (await res.json()) as {
        settings: PlatformSettingsItem;
        credentialsStatus: typeof credentialsStatus;
      };
      setSettings(data.settings);
      setCredentialsStatus(data.credentialsStatus);
    }
  }, [authFetch]);

  const loadUsers = useCallback(async () => {
    const res = await authFetch('/api/admin/users');
    if (res.ok) {
      const data = (await res.json()) as { users: typeof registeredUsers };
      setRegisteredUsers(data.users);
    }
  }, [authFetch]);

  const loadReviews = useCallback(async () => {
    const res = await authFetch('/api/admin/reviews');
    if (res.ok) {
      const data = (await res.json()) as { reviews: SiteReviewItem[] };
      setAdminReviews(data.reviews);
    }
  }, [authFetch]);

  useEffect(() => {
    if (dbUser?.role === 'admin') {
      loadOverview();
      loadSources();
      loadSettings();
    }
  }, [dbUser, loadOverview, loadSources, loadSettings]);

  useEffect(() => {
    if (dbUser?.role === 'admin' && tab === 'jobs') loadAdminJobs();
    if (dbUser?.role === 'admin' && tab === 'reviews') loadReviews();
    if (dbUser?.role === 'admin' && tab === 'users') loadUsers();
  }, [dbUser, tab, loadAdminJobs, loadReviews, loadUsers]);

  if (!dbUser || dbUser.role !== 'admin') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
            Administrator Access Required
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            This console is restricted to authorised platform administrators.
          </p>
        </div>
      </div>
    );
  }

  const handleSyncNow = async (sourceId?: number) => {
    setSyncing(true);
    setBanner(null);
    try {
      const res = await authFetch('/api/admin/sync', {
        method: 'POST',
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      const data = (await res.json()) as {
        summary?: {
          sourcesProcessed: number;
          jobsDiscovered: number;
          jobsAdded: number;
          duplicatesMerged: number;
          jobsExpired: number;
          skippedUnconfigured?: string[];
          errors: Array<{ sourceName: string; error: string }>;
        };
        error?: string;
      };
      if (!res.ok) {
        setBanner({ type: 'error', text: data.error || 'Sync failed.' });
      } else if (data.summary) {
        const s = data.summary;
        const skipped = s.skippedUnconfigured || [];
        const errNote =
          s.errors.length > 0
            ? ` (${s.errors.length} source error: ${s.errors[0].sourceName})`
            : '';
        const skippedNote =
          skipped.length > 0
            ? ` (${skipped.join(', ')} skipped — integration not connected yet)`
            : '';

        if (s.sourcesProcessed === 0 && skipped.length > 0 && s.errors.length === 0) {
          setBanner({
            type: 'info',
            text: `${skipped.join(', ')} is not connected yet. Add credentials in server environment secrets when ready, or enable public RSS/JSON feeds.`,
          });
        } else {
          setBanner({
            type: s.errors.length > 0 && s.jobsAdded === 0 ? 'error' : 'success',
            text: `Sync complete across ${s.sourcesProcessed} source(s): ${s.jobsDiscovered} discovered, ${s.jobsAdded} added, ${s.duplicatesMerged} duplicates grouped, ${s.jobsExpired} expired.${skippedNote}${errNote}`,
          });
        }
        loadOverview();
        loadSources();
        loadAdminJobs();
        onDataChanged();
      }
    } catch {
      setBanner({ type: 'error', text: 'Failed to reach aggregation service.' });
    } finally {
      setSyncing(false);
    }
  };

  const openAddJobModal = () => {
    setEditingJob(null);
    setJobForm({
      title: '',
      companyName: '',
      categoryId: String(categories[0]?.id || ''),
      location: '',
      workArrangement: 'Remote',
      employmentType: 'Full-time',
      experienceLevel: 'Mid-level',
      salaryText: '',
      applicationEmail: '',
      applicationUrl: '',
      applicationInstructions: '',
      description: '',
      requirements: '',
      skills: '',
      status: 'verified',
      isSampleData: false,
    });
    setJobModalOpen(true);
  };

  const openEditJobModal = (job: JobListing) => {
    setEditingJob(job);
    setJobForm({
      title: job.title,
      companyName: job.companyName,
      categoryId: String(job.categoryId || categories[0]?.id || ''),
      location: job.location,
      workArrangement: job.workArrangement,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel || 'Mid-level',
      salaryText: job.salaryText || '',
      applicationEmail: job.applicationEmail || '',
      applicationUrl: job.applicationUrl || '',
      applicationInstructions: job.applicationInstructions || '',
      description: job.description,
      requirements: job.requirements,
      skills: (job.skills || []).join(', '),
      status: job.status,
      isSampleData: Boolean(job.isSampleData),
    });
    setJobModalOpen(true);
  };

  const handleSaveJobModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (editingJob) {
      const res = await authFetch(`/api/admin/jobs/${editingJob.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: jobForm.title,
          companyName: jobForm.companyName,
          categoryId: jobForm.categoryId ? Number(jobForm.categoryId) : undefined,
          location: jobForm.location,
          workArrangement: jobForm.workArrangement,
          employmentType: jobForm.employmentType,
          experienceLevel: jobForm.experienceLevel,
          salaryText: jobForm.salaryText || null,
          applicationEmail: jobForm.applicationEmail || null,
          applicationUrl: jobForm.applicationUrl || null,
          applicationInstructions: jobForm.applicationInstructions || null,
          description: jobForm.description,
          requirements: jobForm.requirements,
          skills: jobForm.skills,
          status: jobForm.status,
          isSampleData: jobForm.isSampleData,
        }),
      });
      if (res.ok) {
        setJobModalOpen(false);
        setBanner({ type: 'success', text: 'Job listing updated.' });
        loadAdminJobs();
        loadOverview();
        onDataChanged();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setBanner({ type: 'error', text: err.error || 'Unable to update job listing.' });
      }
    } else {
      const res = await authFetch('/api/admin/jobs', {
        method: 'POST',
        body: JSON.stringify({
          ...jobForm,
          categoryId: jobForm.categoryId ? Number(jobForm.categoryId) : null,
        }),
      });
      if (res.ok) {
        setJobModalOpen(false);
        setBanner({ type: 'success', text: 'New real job listing published.' });
        loadAdminJobs();
        loadOverview();
        onDataChanged();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setBanner({ type: 'error', text: err.error || 'Unable to publish job listing.' });
      }
    }
  };

  const handleUpdateJobStatus = async (id: number, status: string) => {
    const res = await authFetch(`/api/admin/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      loadAdminJobs();
      loadOverview();
      onDataChanged();
    }
  };

  const handleDeleteJob = async (id: number) => {
    const res = await authFetch(`/api/admin/jobs/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadAdminJobs();
      loadOverview();
      onDataChanged();
    }
  };

  const handlePurgeExpired = async () => {
    const res = await authFetch('/api/admin/jobs/purge-expired', { method: 'POST' });
    if (res.ok) {
      const data = (await res.json()) as { purgedCount: number };
      setBanner({ type: 'success', text: `Removed ${data.purgedCount} expired job listings.` });
      loadAdminJobs();
      loadOverview();
      onDataChanged();
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await authFetch('/api/admin/sources', {
      method: 'POST',
      body: JSON.stringify(newSource),
    });
    if (res.ok) {
      setNewSource({ name: '', sourceType: 'rss_feed', endpointUrl: '', apiKeyEnvVar: '' });
      setBanner({ type: 'success', text: 'External job source added.' });
      loadSources();
      loadOverview();
    }
  };

  const handleToggleSource = async (source: JobSourceItem) => {
    const res = await authFetch(`/api/admin/sources/${source.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !source.enabled }),
    });
    if (res.ok) {
      loadSources();
      loadOverview();
    }
  };

  const handleUpdateSourceCountry = async (source: JobSourceItem, country: string) => {
    const res = await authFetch(`/api/admin/sources/${source.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        apiConfigJson: { ...(source.apiConfigJson || {}), country },
      }),
    });
    if (res.ok) {
      setBanner({ type: 'success', text: `Updated ${source.name} target country to ${country.toUpperCase()}.` });
      loadSources();
    }
  };

  const handleDeleteSource = async (id: number) => {
    const res = await authFetch(`/api/admin/sources/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadSources();
      loadOverview();
    }
  };

  const handleSaveSettings = async (
    e?: React.FormEvent,
    override?: Partial<PlatformSettingsItem>,
    customSuccessMessage?: string
  ) => {
    if (e) e.preventDefault();
    if (!settings) return;
    const payload = override ? { ...settings, ...override } : settings;
    if (override) {
      setSettings(payload);
    }
    const res = await authFetch('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setBanner({
        type: 'success',
        text: customSuccessMessage || 'Platform settings saved.',
      });
      loadSettings();
      onDataChanged();
    }
  };

  const handleRestoreSampleJobs = async () => {
    setBanner(null);
    const res = await authFetch('/api/admin/demo/restore', { method: 'POST' });
    if (res.ok) {
      const data = (await res.json()) as { restoredCount: number };
      setBanner({
        type: 'success',
        text:
          data.restoredCount > 0
            ? `Restored ${data.restoredCount} clearly labelled sample demo listings.`
            : 'Sample demo listings are already present.',
      });
      loadOverview();
      loadAdminJobs();
      onDataChanged();
    }
  };

  const handleClearSampleJobs = async () => {
    setBanner(null);
    const res = await authFetch('/api/admin/demo/clear', { method: 'POST' });
    if (res.ok) {
      const data = (await res.json()) as { clearedCount: number };
      setBanner({
        type: 'info',
        text: `Removed ${data.clearedCount} sample demo listing(s). Real and manually published jobs remain untouched.`,
      });
      loadOverview();
      loadAdminJobs();
      onDataChanged();
    }
  };

  const handleSendTestEmail = async () => {
    setBanner(null);
    const res = await authFetch('/api/admin/test-email', {
      method: 'POST',
      body: JSON.stringify({ email: dbUser.email }),
    });
    const data = (await res.json()) as { status?: string; errorMessage?: string };
    setBanner({
      type:
        data.status === 'sent'
          ? 'success'
          : data.status === 'queued_unconfigured'
            ? 'info'
            : 'error',
      text:
        data.status === 'sent'
          ? `Test email sent to ${dbUser.email}.`
          : data.errorMessage || 'Email integration is not connected yet.',
    });
    loadOverview();
  };

  const handleToggleUserRole = async (id: number, currentRole: string) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    const res = await authFetch(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: nextRole }),
    });
    if (res.ok) loadUsers();
  };

  const handleDeleteReview = async (id: number) => {
    const res = await authFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    if (res.ok) loadReviews();
  };

  const adzunaSource = sources.find((s) => s.sourceType === 'adzuna_api');
  const publicFeedSources = sources.filter((s) => s.sourceType !== 'adzuna_api');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Admin Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Administrator Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Manage real and sample job listings, external integrations, demo mode, and automation rules.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleSyncNow()}
          disabled={syncing}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 dark:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing Sources...' : 'Sync Enabled Feeds'}
        </button>
      </div>

      {banner && (
        <div
          className={`mt-5 rounded-lg border px-4 py-3 text-sm font-medium ${
            banner.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
              : banner.type === 'info'
                ? 'border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                : 'border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'jobs', label: 'Job Management', icon: Briefcase },
          { id: 'integrations', label: 'Integrations', icon: Plug },
          { id: 'automation', label: 'Demo Mode & Automation', icon: Settings },
          { id: 'reviews', label: 'Website Reviews', icon: Mail },
          { id: 'users', label: 'Users', icon: Users },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as AdminTab)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* TAB: OVERVIEW */}
      {tab === 'overview' && (
        <div className="mt-8 space-y-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Total Listings', value: stats.totalJobs },
              { label: 'New Today', value: stats.newToday },
              { label: 'Active Listings', value: stats.activeJobs },
              { label: 'Expired Listings', value: stats.expiredJobs },
              { label: 'Registered Users', value: stats.totalUsers },
              { label: 'Enabled Feeds', value: stats.connectedSources },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
                <p className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Sync Activity */}
            <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                Recent Collection Activity
              </h2>
              {syncLogs.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  No source synchronisations recorded yet. You can run on-demand syncs from public
                  feeds or connect Adzuna later on the Integrations tab.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="py-2 pr-3 font-semibold">Source</th>
                        <th className="py-2 pr-3 font-semibold">Status</th>
                        <th className="py-2 pr-3 font-semibold text-right">Added</th>
                        <th className="py-2 pr-3 font-semibold text-right">Merged</th>
                        <th className="py-2 font-semibold text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {syncLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                            {log.sourceName}
                            {log.message && (
                              <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 line-clamp-1">
                                {log.message}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`font-semibold capitalize ${
                                log.status === 'success'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : log.status === 'not_connected'
                                    ? 'text-slate-500 dark:text-slate-400'
                                    : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {log.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">{log.jobsAdded}</td>
                          <td className="py-2.5 pr-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                            {log.duplicatesMerged}
                          </td>
                          <td className="py-2.5 text-right text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                            {new Date(log.startedAt).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Notification Logs */}
            <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                Email Notification Log
              </h2>
              {notificationLogs.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  No alert emails queued yet. Alerts subscribed by job seekers are safely stored in
                  PostgreSQL until Resend or SMTP is connected.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {notificationLogs.map((n) => (
                    <div key={n.id} className="py-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {n.recipientEmail}
                        </span>
                        <span
                          className={`font-semibold capitalize ${
                            n.status === 'sent'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : n.status === 'failed'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {n.status === 'queued_unconfigured'
                            ? 'Queued (not connected)'
                            : n.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-600 dark:text-slate-300 truncate">{n.subject}</p>
                      {n.errorMessage && (
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{n.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: JOB MANAGEMENT */}
      {tab === 'jobs' && (
        <div className="mt-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Filter jobs by title, company, source..."
                className="w-64 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
              />
              <select
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
                <option value="active">Active</option>
                <option value="pending_review">Pending Review</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePurgeExpired}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Remove Expired Jobs
              </button>
              <button
                type="button"
                onClick={openAddJobModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 dark:bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Job Manually
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Role & Company</th>
                  <th className="px-4 py-3 font-semibold">Origin</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Published</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {adminJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{job.title}</p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {job.companyName} · {job.location} · {job.workArrangement}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {job.isSampleData ? (
                        <span className="font-semibold text-amber-700 dark:text-amber-400">Sample Demo Listing</span>
                      ) : (
                        <span>{job.sourceName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold capitalize ${
                          job.status === 'verified' || job.status === 'active'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : job.status === 'expired'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {job.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {new Date(job.publishedAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {job.status !== 'verified' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateJobStatus(job.id, 'verified')}
                            title="Approve & Mark Verified"
                            className="rounded p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        {job.status !== 'expired' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateJobStatus(job.id, 'expired')}
                            title="Mark Expired"
                            className="rounded p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 cursor-pointer"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditJobModal(job)}
                          title="Edit Job"
                          className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteJob(job.id)}
                          title="Delete Job"
                          className="rounded p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: INTEGRATIONS SETTINGS PAGE */}
      {tab === 'integrations' && (
        <div className="mt-8 space-y-8">
          {/* Calm summary notice */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-5 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                External integrations are completely optional during setup
              </p>
              <p className="mt-1">
                Kelvs job search operates cleanly without Adzuna, Resend, or SMTP credentials. You
                can publish real jobs manually, explore clearly labelled demo listings, or enable
                open public feeds below and connect API credentials whenever you are ready.
              </p>
            </div>
          </div>

          {/* Primary Optional Integrations Grid: Adzuna, Resend, SMTP */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Adzuna Integration Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                    Adzuna Job Search API
                  </h2>
                  <span
                    className={`text-xs font-semibold ${
                      credentialsStatus.hasAdzunaCredentials
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {credentialsStatus.hasAdzunaCredentials ? 'Connected' : 'Not connected'}
                  </span>
                </div>

                {!credentialsStatus.hasAdzunaCredentials ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Adzuna integration is not connected. Add{' '}
                    <code className="font-mono text-slate-800 dark:text-slate-200">ADZUNA_APP_ID</code> and{' '}
                    <code className="font-mono text-slate-800 dark:text-slate-200">ADZUNA_APP_KEY</code> in your server
                    environment secrets when ready to sync Adzuna listings.
                  </p>
                ) : (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    Adzuna API credentials are configured in server secrets and ready to sync.
                  </p>
                )}

                {adzunaSource && (
                  <div className="pt-2 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Target Country Region
                      </label>
                      <select
                        value={adzunaSource.apiConfigJson?.country || 'gb'}
                        onChange={(e) => handleUpdateSourceCountry(adzunaSource, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="gb">United Kingdom (gb)</option>
                        <option value="us">United States (us)</option>
                        <option value="ca">Canada (ca)</option>
                        <option value="de">Germany (de)</option>
                        <option value="au">Australia (au)</option>
                        <option value="fr">France (fr)</option>
                        <option value="in">India (in)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {adzunaSource && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                  <button
                    type="button"
                    onClick={() => handleToggleSource(adzunaSource)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                      adzunaSource.enabled
                        ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {adzunaSource.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSyncNow(adzunaSource.id)}
                    disabled={syncing}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Test Sync
                  </button>
                </div>
              )}
            </div>

            {/* Resend Email Integration Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                    Resend Email API
                  </h2>
                  <span
                    className={`text-xs font-semibold ${
                      credentialsStatus.hasResendKey
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {credentialsStatus.hasResendKey ? 'Connected' : 'Not connected'}
                  </span>
                </div>

                {!credentialsStatus.hasResendKey ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Resend integration is not connected. Alert subscriptions remain saved in
                    PostgreSQL and email dispatches are safely logged until{' '}
                    <code className="font-mono text-slate-800 dark:text-slate-200">RESEND_API_KEY</code> is added to
                    server environment secrets.
                  </p>
                ) : (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    Resend API key is present in server secrets and ready for job alert delivery.
                  </p>
                )}
              </div>

              {settings && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {settings.emailProvider === 'resend'
                      ? 'Selected as active provider'
                      : 'Inactive provider'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleSaveSettings(
                        undefined,
                        { emailProvider: 'resend' },
                        'Resend selected as email provider.'
                      )
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                      settings.emailProvider === 'resend'
                        ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {settings.emailProvider === 'resend' ? 'Selected' : 'Use Resend'}
                  </button>
                </div>
              )}
            </div>

            {/* SMTP Email Integration Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                    Custom SMTP Relay
                  </h2>
                  <span
                    className={`text-xs font-semibold ${
                      credentialsStatus.hasSmtpCredentials
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {credentialsStatus.hasSmtpCredentials ? 'Connected' : 'Not connected'}
                  </span>
                </div>

                {!credentialsStatus.hasSmtpCredentials ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    SMTP integration is not connected. When ready, configure{' '}
                    <code className="font-mono text-slate-800 dark:text-slate-200">SMTP_HOST</code> and{' '}
                    <code className="font-mono text-slate-800 dark:text-slate-200">SMTP_PASS</code> in server secrets
                    and enter your host settings below.
                  </p>
                ) : (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    SMTP host and password are configured in server secrets.
                  </p>
                )}
              </div>

              {settings && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {settings.emailProvider === 'smtp'
                      ? 'Selected as active provider'
                      : 'Inactive provider'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleSaveSettings(
                        undefined,
                        { emailProvider: 'smtp' },
                        'SMTP selected as email provider.'
                      )
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                      settings.emailProvider === 'smtp'
                        ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {settings.emailProvider === 'smtp' ? 'Selected' : 'Use SMTP'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Email Delivery Configuration Panel */}
          {settings && (
            <form
              onSubmit={(e) =>
                handleSaveSettings(e, undefined, 'Email delivery configuration updated.')
              }
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Mail className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                      Email Delivery Settings
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Choose how alerts are handled while testing or once email credentials are
                      connected.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  Test Email Delivery
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Active Email Mode
                  </label>
                  <select
                    value={settings.emailProvider}
                    onChange={(e) => setSettings({ ...settings, emailProvider: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="none">Log Only (Not Connected — Safe Testing)</option>
                    <option value="resend">Resend API (Requires RESEND_API_KEY secret)</option>
                    <option value="smtp">Custom SMTP (Requires SMTP_PASS secret)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Review Recipient Gmail
                  </label>
                  <input
                    type="email"
                    value={settings.reviewRecipientEmail || 'ebaluegbefodestiny@gmail.com'}
                    onChange={(e) =>
                      setSettings({ ...settings, reviewRecipientEmail: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sender From Address
                  </label>
                  <input
                    type="email"
                    value={settings.emailFromAddress}
                    onChange={(e) =>
                      setSettings({ ...settings, emailFromAddress: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={settings.smtpHost || ''}
                    onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                    placeholder="smtp.example.com"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      value={settings.smtpPort || 587}
                      onChange={(e) =>
                        setSettings({ ...settings, smtpPort: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      SMTP User
                    </label>
                    <input
                      type="text"
                      value={settings.smtpUser || ''}
                      onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                      placeholder="user"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emailNotificationsEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, emailNotificationsEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-700"
                  />
                  Enable alert dispatch when email provider is connected
                </label>

                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 dark:bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
                >
                  Save Email Settings
                </button>
              </div>
            </form>
          )}

          {/* Public Job Feeds & Custom Sources */}
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  Public Job Feeds & Employer Sources
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  These connectors work via public JSON APIs or RSS/Atom feeds without requiring
                  API keys. Enable any feed and click Sync to pull real listings.
                </p>
              </div>

              {publicFeedSources.map((src) => (
                <div
                  key={src.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">{src.name}</h3>
                      <span
                        className={`text-xs font-semibold capitalize ${
                          src.status === 'healthy'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : src.status === 'error'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {src.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                      {src.endpointUrl}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      Type: {src.sourceType} · Collected: {src.jobsCollectedCount} · Last synced:{' '}
                      {src.lastSyncedAt
                        ? new Date(src.lastSyncedAt).toLocaleString('en-GB')
                        : 'Never'}
                    </p>
                    {src.apiKeyEnvVar && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        Required server secret:{' '}
                        <code className="font-mono">{src.apiKeyEnvVar}</code>
                      </p>
                    )}
                    {src.lastError && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {src.lastError}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleSource(src)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                        src.enabled
                          ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {src.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSyncNow(src.id)}
                      disabled={syncing}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      Sync
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSource(src.id)}
                      title="Delete Source"
                      className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-4">
              <form
                onSubmit={handleAddSource}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  Add New Job Source
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Connect authorised RSS feeds, public JSON job APIs, or employer career page JSON
                  endpoints without rebuilding the application.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Source Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newSource.name}
                    onChange={(e) => setNewSource((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Company Engineering RSS"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Connector Type
                  </label>
                  <select
                    value={newSource.sourceType}
                    onChange={(e) => setNewSource((p) => ({ ...p, sourceType: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                  >
                    <option value="rss_feed">Authorised RSS / Atom Feed</option>
                    <option value="career_json">Employer Career Page JSON API</option>
                    <option value="remotive_api">Remotive API Format</option>
                    <option value="arbeitnow_api">Arbeitnow API Format</option>
                    <option value="jobicy_api">Jobicy API Format</option>
                    <option value="remoteok_api">RemoteOK API Format</option>
                    <option value="himalayas_api">Himalayas API Format</option>
                    <option value="adzuna_api">Adzuna Search API (Requires Secrets)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Feed or API Endpoint URL
                  </label>
                  <input
                    type="url"
                    required
                    value={newSource.endpointUrl}
                    onChange={(e) => setNewSource((p) => ({ ...p, endpointUrl: e.target.value }))}
                    placeholder="https://example.com/careers/jobs.rss"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Required Env Var Name (optional)
                  </label>
                  <input
                    type="text"
                    value={newSource.apiKeyEnvVar}
                    onChange={(e) => setNewSource((p) => ({ ...p, apiKeyEnvVar: e.target.value }))}
                    placeholder="e.g. ADZUNA_APP_ID / ADZUNA_APP_KEY"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-700 dark:bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
                >
                  Add Source
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DEMO MODE & AUTOMATION RULES */}
      {tab === 'automation' && settings && (
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            {/* Demo Mode Control Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                    Demo Mode & Sample Testing Listings
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                    Demo listings are clearly marked as sample data so you can test search, filters,
                    categories, and job detail pages without external APIs. Sample jobs are never
                    presented as real vacancies.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleSaveSettings(
                      undefined,
                      { demoModeEnabled: !settings.demoModeEnabled },
                      !settings.demoModeEnabled
                        ? 'Demo Mode enabled — clearly labelled sample listings are visible in public search.'
                        : 'Demo Mode hidden — public search now displays only real and manually published vacancies.'
                    )
                  }
                  className={`rounded-lg border px-4 py-2 text-xs font-semibold cursor-pointer ${
                    settings.demoModeEnabled
                      ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {settings.demoModeEnabled ? 'Demo Mode: Active' : 'Demo Mode: Hidden'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={handleRestoreSampleJobs}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore Sample Jobs
                </button>
                <button
                  type="button"
                  onClick={handleClearSampleJobs}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Sample Jobs
                </button>
              </div>
            </div>

            {/* Automated Collection Rules */}
            <form
              onSubmit={(e) =>
                handleSaveSettings(e, undefined, 'Automated collection settings updated.')
              }
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6"
            >
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  Automated Collection & Verification Rules
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Configure background sync schedules, duplicate merging, and expiry thresholds.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Automatic Sync Interval (Hours)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={settings.syncIntervalHours}
                    onChange={(e) =>
                      setSettings({ ...settings, syncIntervalHours: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Auto-Expire After (Days)
                  </label>
                  <input
                    type="number"
                    min={7}
                    max={180}
                    value={settings.expiryDaysThreshold}
                    onChange={(e) =>
                      setSettings({ ...settings, expiryDaysThreshold: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoSyncEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, autoSyncEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-700"
                  />
                  Enable scheduled background sync across enabled external sources
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoExpiryCheckEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, autoExpiryCheckEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-700"
                  />
                  Automatically expire outdated or unavailable external job links
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.duplicateDetectionEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, duplicateDetectionEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-700"
                  />
                  Detect and group duplicate vacancies across multiple sources
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoVerifyTrustedSources}
                    onChange={(e) =>
                      setSettings({ ...settings, autoVerifyTrustedSources: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-700"
                  />
                  Auto-verify newly collected jobs (leave unchecked for manual administrator review)
                </label>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 dark:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
                >
                  Save Automation Rules
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 h-fit">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
              Server Secret Readiness
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              API keys and passwords live exclusively in server environment secrets—never stored in
              browser inputs.
            </p>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-700 dark:text-slate-300">ADZUNA_APP_ID / KEY</span>
                <span
                  className={
                    credentialsStatus.hasAdzunaCredentials
                      ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }
                >
                  {credentialsStatus.hasAdzunaCredentials ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-700 dark:text-slate-300">RESEND_API_KEY</span>
                <span
                  className={
                    credentialsStatus.hasResendKey
                      ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }
                >
                  {credentialsStatus.hasResendKey ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-700 dark:text-slate-300">SMTP_HOST / SMTP_PASS</span>
                <span
                  className={
                    credentialsStatus.hasSmtpCredentials
                      ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }
                >
                  {credentialsStatus.hasSmtpCredentials ? 'Connected' : 'Not connected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: WEBSITE REVIEWS */}
      {tab === 'reviews' && (
        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                Submitted Website Reviews
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                All visitor feedback submitted at the bottom of Kelvs job search is saved here and
                routed to {settings?.reviewRecipientEmail || 'ebaluegbefodestiny@gmail.com'}.
              </p>
            </div>
          </div>

          {adminReviews.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No website reviews submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Reviewer</th>
                    <th className="px-4 py-3 font-semibold">Rating</th>
                    <th className="px-4 py-3 font-semibold">Comment</th>
                    <th className="px-4 py-3 font-semibold">Email Delivery</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {adminReviews.map((rev) => (
                    <tr key={rev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{rev.reviewerName}</p>
                        {rev.reviewerEmail && (
                          <p className="text-slate-500 dark:text-slate-400">{rev.reviewerEmail}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                        {rev.rating} / 5
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-md">{rev.comment}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            rev.emailStatus === 'sent'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {rev.emailStatus === 'sent'
                            ? `Sent to ${rev.deliveredToEmail}`
                            : 'Saved (connect email secret for auto-send)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {new Date(rev.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(rev.id)}
                          className="rounded p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                          title="Delete Review"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: USERS */}
      {tab === 'users' && (
        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {registeredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {u.displayName || 'User'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                  <td className="px-4 py-3 font-semibold capitalize text-slate-800 dark:text-slate-200">{u.role}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums">
                    {new Date(u.createdAt).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.email !== dbUser.email && (
                      <button
                        type="button"
                        onClick={() => handleToggleUserRole(u.id, u.role)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Job Modal */}
      {jobModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {editingJob ? 'Edit Job Listing' : 'Add Real Job Listing'}
            </h2>

            <form onSubmit={handleSaveJobModal} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    required
                    value={jobForm.title}
                    onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    required
                    value={jobForm.companyName}
                    onChange={(e) => setJobForm({ ...jobForm, companyName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    required
                    value={jobForm.location}
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Work Arrangement
                  </label>
                  <select
                    value={jobForm.workArrangement}
                    onChange={(e) => setJobForm({ ...jobForm, workArrangement: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Onsite">Onsite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Employment Type
                  </label>
                  <select
                    value={jobForm.employmentType}
                    onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={jobForm.categoryId}
                    onChange={(e) => setJobForm({ ...jobForm, categoryId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Experience Level
                  </label>
                  <select
                    value={jobForm.experienceLevel}
                    onChange={(e) => setJobForm({ ...jobForm, experienceLevel: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="Entry-level">Entry-level</option>
                    <option value="Mid-level">Mid-level</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={jobForm.status}
                    onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="verified">Verified</option>
                    <option value="active">Active</option>
                    <option value="unverified">Unverified</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Skills (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={jobForm.skills}
                    onChange={(e) => setJobForm({ ...jobForm, skills: e.target.value })}
                    placeholder="React, TypeScript, CSS"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Salary Information (optional)
                  </label>
                  <input
                    type="text"
                    value={jobForm.salaryText}
                    onChange={(e) => setJobForm({ ...jobForm, salaryText: e.target.value })}
                    placeholder="e.g. £50,000 - £65,000"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Application Email (only if publicly provided)
                  </label>
                  <input
                    type="email"
                    value={jobForm.applicationEmail}
                    onChange={(e) =>
                      setJobForm({ ...jobForm, applicationEmail: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Direct Application URL
                  </label>
                  <input
                    type="url"
                    value={jobForm.applicationUrl}
                    onChange={(e) => setJobForm({ ...jobForm, applicationUrl: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Application Instructions (optional)
                </label>
                <input
                  type="text"
                  value={jobForm.applicationInstructions}
                  onChange={(e) =>
                    setJobForm({ ...jobForm, applicationInstructions: e.target.value })
                  }
                  placeholder="e.g. Include portfolio link or reference code in subject line"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Job Description
                </label>
                <textarea
                  required
                  rows={4}
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Requirements & Qualifications
                </label>
                <textarea
                  rows={3}
                  value={jobForm.requirements}
                  onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              {editingJob && (
                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={jobForm.isSampleData}
                    onChange={(e) => setJobForm({ ...jobForm, isSampleData: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-700"
                  />
                  Mark as sample demo listing (uncheck only if this is a real verified vacancy)
                </label>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setJobModalOpen(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 dark:bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
                >
                  {editingJob ? 'Save Changes' : 'Publish Real Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

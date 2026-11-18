import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Bookmark, Trash2, User, Check, Pause, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { AppView, CategoryItem, JobAlertItem, JobListing } from '../types.ts';
import { JobCard } from './JobCard.tsx';

interface AccountPortalProps {
  activeTab: 'saved' | 'alerts' | 'profile';
  categories: CategoryItem[];
  onNavigate: (view: AppView) => void;
  onSelectJob: (job: JobListing) => void;
  onToggleSave: (job: JobListing) => Promise<void>;
}

export function AccountPortal({
  activeTab,
  categories,
  onNavigate,
  onSelectJob,
  onToggleSave,
}: AccountPortalProps) {
  const { firebaseUser, dbUser, signInWithGoogle, authFetch, refreshProfile } = useAuth();

  const [savedJobs, setSavedJobs] = useState<JobListing[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const [alerts, setAlerts] = useState<JobAlertItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Alert creation form
  const [alertEmail, setAlertEmail] = useState('');
  const [alertKeywords, setAlertKeywords] = useState('');
  const [alertCategory, setAlertCategory] = useState('');
  const [alertLocation, setAlertLocation] = useState('');
  const [alertWorkMode, setAlertWorkMode] = useState('Any');
  const [alertExpLevel, setAlertExpLevel] = useState('Any');
  const [alertFrequency, setAlertFrequency] = useState<'daily' | 'instant'>('instant');
  const [alertStatus, setAlertStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Profile form
  const [displayName, setDisplayName] = useState('');
  const [prefCategories, setPrefCategories] = useState<string[]>([]);
  const [prefLocations, setPrefLocations] = useState('');
  const [prefWorkMode, setPrefWorkMode] = useState('any');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  useEffect(() => {
    if (dbUser) {
      setDisplayName(dbUser.displayName || '');
      setPrefCategories(dbUser.preferredCategories || []);
      setPrefLocations((dbUser.preferredLocations || []).join(', '));
      setPrefWorkMode(dbUser.preferredWorkMode || 'any');
      setAlertEmail(dbUser.email);
    }
  }, [dbUser]);

  const loadSaved = useCallback(async () => {
    if (!firebaseUser) return;
    setLoadingSaved(true);
    try {
      const res = await authFetch('/api/saved-jobs');
      if (res.ok) {
        const data = (await res.json()) as { savedJobs: JobListing[] };
        setSavedJobs(data.savedJobs);
      }
    } finally {
      setLoadingSaved(false);
    }
  }, [firebaseUser, authFetch]);

  const loadAlerts = useCallback(async () => {
    if (!firebaseUser) return;
    setLoadingAlerts(true);
    try {
      const res = await authFetch('/api/alerts');
      if (res.ok) {
        const data = (await res.json()) as { alerts: JobAlertItem[] };
        setAlerts(data.alerts);
      }
    } finally {
      setLoadingAlerts(false);
    }
  }, [firebaseUser, authFetch]);

  useEffect(() => {
    if (firebaseUser) {
      loadSaved();
      loadAlerts();
    }
  }, [firebaseUser, loadSaved, loadAlerts]);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertStatus(null);

    if (!alertKeywords.trim()) {
      setAlertStatus({ type: 'error', text: 'Enter a role or keywords (e.g. Website Developer).' });
      return;
    }

    try {
      if (firebaseUser) {
        const res = await authFetch('/api/alerts', {
          method: 'POST',
          body: JSON.stringify({
            keywords: alertKeywords.trim(),
            categorySlug: alertCategory || null,
            location: alertLocation.trim() || null,
            workArrangement: alertWorkMode,
            experienceLevel: alertExpLevel,
            frequency: alertFrequency,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setAlertStatus({ type: 'error', text: data.error || 'Could not create alert.' });
          return;
        }
        setAlertStatus({ type: 'success', text: 'Job alert created and active.' });
        setAlertKeywords('');
        setAlertLocation('');
        loadAlerts();
      } else {
        if (!alertEmail.trim()) {
          setAlertStatus({ type: 'error', text: 'Enter your email address.' });
          return;
        }
        const res = await fetch('/api/alerts/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: alertEmail.trim(),
            keywords: alertKeywords.trim(),
            categorySlug: alertCategory || null,
            location: alertLocation.trim() || null,
            workArrangement: alertWorkMode,
            experienceLevel: alertExpLevel,
            frequency: alertFrequency,
          }),
        });
        const data = (await res.json()) as { message?: string; error?: string };
        if (!res.ok) {
          setAlertStatus({ type: 'error', text: data.error || 'Could not create alert.' });
          return;
        }
        setAlertStatus({ type: 'success', text: data.message || 'Job alert subscribed.' });
        setAlertKeywords('');
      }
    } catch {
      setAlertStatus({ type: 'error', text: 'Network error while saving job alert.' });
    }
  };

  const handleToggleAlert = async (alert: JobAlertItem) => {
    const res = await authFetch(`/api/alerts/${alert.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !alert.isActive }),
    });
    if (res.ok) loadAlerts();
  };

  const handleDeleteAlert = async (id: number) => {
    const res = await authFetch(`/api/alerts/${id}`, { method: 'DELETE' });
    if (res.ok) loadAlerts();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    const res = await authFetch('/api/me', {
      method: 'PUT',
      body: JSON.stringify({
        displayName,
        preferredCategories: prefCategories,
        preferredLocations: prefLocations
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferredWorkMode: prefWorkMode,
      }),
    });
    if (res.ok) {
      await refreshProfile();
      setProfileMessage('Preferences saved.');
    } else {
      setProfileMessage('Unable to save preferences.');
    }
  };

  const togglePrefCategory = (slug: string) => {
    setPrefCategories((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('alerts')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bell className="h-4 w-4" />
            Job Alerts
          </button>
          <button
            type="button"
            onClick={() => onNavigate('saved')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bookmark className="h-4 w-4" />
            Saved Jobs
          </button>
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <User className="h-4 w-4" />
            Profile & Preferences
          </button>
        </div>

        {!firebaseUser && (
          <button
            type="button"
            onClick={signInWithGoogle}
            className="rounded-lg bg-blue-700 dark:bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
          >
            Sign In with Google
          </button>
        )}
      </div>

      {/* SAVED JOBS VIEW */}
      {activeTab === 'saved' && (
        <div className="mt-8">
          {!firebaseUser ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                Sign in to access your saved jobs
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Bookmark opportunities across sessions and revisit direct application instructions
                anytime.
              </p>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="mt-5 rounded-lg bg-blue-700 dark:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
              >
                Sign In with Google
              </button>
            </div>
          ) : loadingSaved ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading saved jobs...</p>
          ) : savedJobs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
                No saved jobs yet
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Click the bookmark icon on any listing to save it here.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('jobs')}
                className="mt-4 rounded-lg bg-blue-700 dark:bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
              >
                Browse Open Positions
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {savedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onSelect={onSelectJob}
                  onToggleSave={async (j) => {
                    await onToggleSave(j);
                    loadSaved();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* JOB ALERTS VIEW */}
      {activeTab === 'alerts' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <form
              onSubmit={handleCreateAlert}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
            >
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">Create Job Alert</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Receive automatic emails whenever matching vacancies are collected.
                </p>
              </div>

              {!firebaseUser && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Job Title or Keywords
                </label>
                <input
                  type="text"
                  required
                  value={alertKeywords}
                  onChange={(e) => setAlertKeywords(e.target.value)}
                  placeholder="e.g. Website Developer"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={alertCategory}
                    onChange={(e) => setAlertCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">Any Category</option>
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={alertLocation}
                    onChange={(e) => setAlertLocation(e.target.value)}
                    placeholder="Any location"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Arrangement
                  </label>
                  <select
                    value={alertWorkMode}
                    onChange={(e) => setAlertWorkMode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                  >
                    <option value="Any">Any</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Onsite">Onsite</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Experience Level
                  </label>
                  <select
                    value={alertExpLevel}
                    onChange={(e) => setAlertExpLevel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                  >
                    <option value="Any">Any</option>
                    <option value="Entry-level">Entry-level</option>
                    <option value="Graduate">Graduate</option>
                    <option value="Mid-level">Mid-level</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notification Frequency
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAlertFrequency('instant')}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer ${
                      alertFrequency === 'instant'
                        ? 'border-blue-700 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Instant Match
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertFrequency('daily')}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer ${
                      alertFrequency === 'daily'
                        ? 'border-blue-700 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Daily Digest
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-700 dark:bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
              >
                Create Alert
              </button>

              {alertStatus && (
                <p
                  className={`text-xs font-medium ${
                    alertStatus.type === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {alertStatus.text}
                </p>
              )}
            </form>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">Your Active Alerts</h2>
              {!firebaseUser ? (
                <div className="mt-4 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-6 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Sign in with Google to view, pause, or delete your saved alerts.
                  </p>
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    className="mt-3 rounded-lg bg-blue-700 dark:bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              ) : loadingAlerts ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading alerts...</p>
              ) : alerts.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  You have not created any job alerts yet. Use the form to subscribe to a role.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between gap-4 py-4">
                      <div>
                        <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {alert.keywords}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {alert.workArrangement} · {alert.experienceLevel}
                          {alert.location ? ` · ${alert.location}` : ''} ·{' '}
                          <span className="capitalize">{alert.frequency}</span> ·{' '}
                          <span className={alert.isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}>
                            {alert.isActive ? 'Active' : 'Paused'}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleAlert(alert)}
                          title={alert.isActive ? 'Pause alert' : 'Resume alert'}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {alert.isActive ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAlert(alert.id)}
                          title="Delete alert"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROFILE & PREFERENCES VIEW */}
      {activeTab === 'profile' && (
        <div className="mt-8 max-w-2xl">
          {!firebaseUser ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                Sign in to manage your career profile
              </h2>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="mt-4 rounded-lg bg-blue-700 dark:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
              >
                Sign In with Google
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSaveProfile}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6"
            >
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                  Account & Job Preferences
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Signed in as {dbUser?.email || firebaseUser.email}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Preferred Work Arrangement
                </label>
                <select
                  value={prefWorkMode}
                  onChange={(e) => setPrefWorkMode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                >
                  <option value="any">Any Arrangement</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Preferred Locations (comma-separated)
                </label>
                <input
                  type="text"
                  value={prefLocations}
                  onChange={(e) => setPrefLocations(e.target.value)}
                  placeholder="e.g. London, Berlin, Remote"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Preferred Categories</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {categories.map((cat) => {
                    const selected = prefCategories.includes(cat.slug);
                    return (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => togglePrefCategory(cat.slug)}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium cursor-pointer ${
                          selected
                            ? 'border-blue-700 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 dark:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
                >
                  Save Preferences
                </button>
                {profileMessage && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{profileMessage}</span>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

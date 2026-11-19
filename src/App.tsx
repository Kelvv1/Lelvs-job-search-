import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { HomePage } from './components/HomePage.tsx';
import { JobsExplorer, SearchFiltersState } from './components/JobsExplorer.tsx';
import { CategoriesDirectory } from './components/CategoriesDirectory.tsx';
import { JobDetailView } from './components/JobDetailView.tsx';
import { AccountPortal } from './components/AccountPortal.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { FloatingWhatsAppButton } from './components/WhatsAppButton.tsx';
import { AppView, CategoryItem, JobListing } from './types.ts';

const DEFAULT_FILTERS: SearchFiltersState = {
  q: '',
  location: '',
  category: '',
  workArrangement: 'All',
  employmentType: 'All',
  experienceLevel: 'All',
  datePosted: '',
  salaryMin: '',
  sort: 'recent',
  origin: 'all',
  page: 1,
};

function AppShell() {
  const { firebaseUser, authFetch, signInWithGoogle } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [previousView, setPreviousView] = useState<AppView>('jobs');
  const [filters, setFilters] = useState<SearchFiltersState>(DEFAULT_FILTERS);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [demoModeEnabled, setDemoModeEnabled] = useState(true);
  const [recentJobs, setRecentJobs] = useState<JobListing[]>([]);
  const [remoteJobs, setRemoteJobs] = useState<JobListing[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const loadHomepageData = useCallback(async () => {
    setHomeLoading(true);
    try {
      const [catRes, recentRes, remoteRes] = await Promise.all([
        fetch('/api/categories'),
        authFetch('/api/jobs?limit=9&sort=recent'),
        authFetch('/api/jobs?workArrangement=Remote&limit=6&sort=recent'),
      ]);

      if (catRes.ok) {
        const catData = (await catRes.json()) as {
          categories: CategoryItem[];
          demoModeEnabled?: boolean;
        };
        setCategories(catData.categories);
        if (typeof catData.demoModeEnabled === 'boolean') {
          setDemoModeEnabled(catData.demoModeEnabled);
        }
      }
      if (recentRes.ok) {
        const recentData = (await recentRes.json()) as { jobs: JobListing[] };
        setRecentJobs(recentData.jobs);
      }
      if (remoteRes.ok) {
        const remoteData = (await remoteRes.json()) as { jobs: JobListing[] };
        setRemoteJobs(remoteData.jobs);
      }
    } catch (err) {
      console.error('Failed to load initial catalog:', err);
    } finally {
      setHomeLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadHomepageData();
  }, [loadHomepageData, refreshTrigger]);

  // Support deep links like ?job=12 or ?q=Website+Developer
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobParam = Number(params.get('job'));
    const qParam = params.get('q');
    if (Number.isInteger(jobParam) && jobParam > 0) {
      setSelectedJobId(jobParam);
      setCurrentView('job-detail');
    } else if (qParam) {
      setFilters({ ...DEFAULT_FILTERS, q: qParam, sort: 'relevant' });
      setCurrentView('jobs');
    }
  }, []);

  const handleNavigate = (view: AppView) => {
    if (view === 'remote') {
      setFilters({ ...DEFAULT_FILTERS, workArrangement: 'Remote' });
      setCurrentView('jobs');
    } else if (view === 'jobs') {
      setFilters(DEFAULT_FILTERS);
      setCurrentView('jobs');
    } else {
      setCurrentView(view);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHeroSearch = (query: string, location: string) => {
    setFilters({
      ...DEFAULT_FILTERS,
      q: query,
      location,
      sort: query.trim() ? 'relevant' : 'recent',
    });
    setCurrentView('jobs');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCategory = (categorySlug: string) => {
    setFilters({
      ...DEFAULT_FILTERS,
      category: categorySlug,
      sort: 'recent',
    });
    setCurrentView('jobs');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectJob = (job: JobListing) => {
    setPreviousView(currentView === 'job-detail' ? 'jobs' : currentView);
    setSelectedJobId(job.id);
    setSelectedJob(job);
    setCurrentView('job-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSave = async (job: JobListing) => {
    if (!firebaseUser) {
      showToast('Please sign in with Google to save jobs.');
      await signInWithGoogle();
      return;
    }

    const willSave = !job.isSaved;
    const res = willSave
      ? await authFetch('/api/saved-jobs', {
          method: 'POST',
          body: JSON.stringify({ jobId: job.id }),
        })
      : await authFetch(`/api/saved-jobs/${job.id}`, {
          method: 'DELETE',
        });

    if (res.ok) {
      const updateList = (list: JobListing[]) =>
        list.map((item) => (item.id === job.id ? { ...item, isSaved: willSave } : item));
      setRecentJobs(updateList);
      setRemoteJobs(updateList);
      setRefreshTrigger((t) => t + 1);
      showToast(willSave ? 'Job saved to your account.' : 'Removed from saved jobs.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Navbar currentView={currentView} onNavigate={handleNavigate} />

      {currentView === 'home' && (
        <HomePage
          recentJobs={recentJobs}
          remoteJobs={remoteJobs}
          categories={categories}
          demoModeEnabled={demoModeEnabled}
          loading={homeLoading}
          onSearch={handleHeroSearch}
          onSelectCategory={handleSelectCategory}
          onSelectJob={handleSelectJob}
          onToggleSave={handleToggleSave}
          onNavigate={handleNavigate}
        />
      )}

      {currentView === 'jobs' && (
        <JobsExplorer
          filters={filters}
          categories={categories}
          onChangeFilters={(next) => setFilters((prev) => ({ ...prev, ...next }))}
          onResetFilters={() => setFilters(DEFAULT_FILTERS)}
          onSelectJob={handleSelectJob}
          onToggleSave={handleToggleSave}
          refreshTrigger={refreshTrigger}
        />
      )}

      {currentView === 'categories' && (
        <CategoriesDirectory
          categories={categories}
          onSelectCategory={handleSelectCategory}
        />
      )}

      {currentView === 'job-detail' && selectedJobId !== null && (
        <JobDetailView
          jobId={selectedJobId}
          initialJob={selectedJob?.id === selectedJobId ? selectedJob : null}
          onBack={() => setCurrentView(previousView)}
          onSelectJob={handleSelectJob}
          onToggleSave={handleToggleSave}
        />
      )}

      {(currentView === 'saved' || currentView === 'alerts' || currentView === 'profile') && (
        <AccountPortal
          activeTab={currentView}
          categories={categories}
          onNavigate={handleNavigate}
          onSelectJob={handleSelectJob}
          onToggleSave={handleToggleSave}
        />
      )}

      {currentView === 'admin' && (
        <AdminDashboard
          categories={categories}
          onDataChanged={() => setRefreshTrigger((t) => t + 1)}
        />
      )}

      <FloatingWhatsAppButton />

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 right-5 z-50 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}

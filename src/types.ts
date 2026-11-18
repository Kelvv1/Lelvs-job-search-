export interface AlternateSource {
  sourceName: string;
  applicationUrl: string;
  collectedAt: string;
}

export interface JobListing {
  id: number;
  title: string;
  slug: string;
  companyId: number | null;
  companyName: string;
  companyLogo: string | null;
  categoryId: number | null;
  categoryName: string;
  description: string;
  requirements: string;
  skills: string[];
  employmentType: string;
  experienceLevel: string;
  location: string;
  workArrangement: string;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  publishedAt: string;
  deadlineAt: string | null;
  applicationEmail: string | null;
  applicationUrl: string | null;
  applicationInstructions: string | null;
  sourceId: number | null;
  sourceName: string;
  sourceUrl: string | null;
  alternateSources: AlternateSource[];
  status: string;
  isSampleData: boolean;
  lastVerifiedAt: string;
  createdAt: string;
  isSaved?: boolean;
}

export interface CategoryItem {
  id: number;
  slug: string;
  name: string;
  keywords: string[];
  description: string;
  jobCount: number;
}

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
  preferredCategories: string[];
  preferredLocations: string[];
  preferredWorkMode: string;
}

export interface JobAlertItem {
  id: number;
  email: string;
  keywords: string;
  categorySlug: string | null;
  location: string | null;
  workArrangement: string;
  experienceLevel: string;
  frequency: 'instant' | 'daily';
  isActive: boolean;
  lastNotifiedAt: string | null;
  createdAt: string;
}

export interface JobSourceItem {
  id: number;
  name: string;
  sourceType: string;
  endpointUrl: string;
  apiKeyEnvVar: string | null;
  apiConfigJson: Record<string, string>;
  enabled: boolean;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  jobsCollectedCount: number;
}

export interface SyncLogItem {
  id: number;
  sourceId: number | null;
  sourceName: string;
  triggerType: string;
  status: string;
  jobsDiscovered: number;
  jobsAdded: number;
  duplicatesMerged: number;
  jobsExpired: number;
  message: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface NotificationLogItem {
  id: number;
  recipientEmail: string;
  subject: string;
  type: string;
  status: string;
  errorMessage: string | null;
  matchedJobsCount: number;
  createdAt: string;
}

export interface PlatformSettingsItem {
  id: number;
  key: string;
  syncIntervalHours: number;
  autoExpiryCheckEnabled: boolean;
  expiryDaysThreshold: number;
  duplicateDetectionEnabled: boolean;
  autoVerifyTrustedSources: boolean;
  emailProvider: string;
  emailFromAddress: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  emailNotificationsEnabled: boolean;
  demoModeEnabled: boolean;
  autoSyncEnabled: boolean;
  reviewRecipientEmail: string;
  lastScheduledRunAt: string | null;
}

export interface SiteReviewItem {
  id: number;
  reviewerName: string;
  reviewerEmail?: string | null;
  rating: number;
  comment: string;
  deliveredToEmail?: string;
  emailStatus?: string;
  createdAt: string;
}

export type AppView =
  | 'home'
  | 'jobs'
  | 'categories'
  | 'remote'
  | 'alerts'
  | 'saved'
  | 'profile'
  | 'job-detail'
  | 'admin';

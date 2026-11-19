import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export interface AlternateSource {
  sourceName: string;
  applicationUrl: string;
  collectedAt: string;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('user'), // 'user' | 'admin'
  preferredCategories: jsonb('preferred_categories').$type<string[]>().notNull().default([]),
  preferredLocations: jsonb('preferred_locations').$type<string[]>().notNull().default([]),
  preferredWorkMode: text('preferred_work_mode').notNull().default('any'), // 'any' | 'remote' | 'hybrid' | 'onsite'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  keywords: jsonb('keywords').$type<string[]>().notNull().default([]),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  websiteUrl: text('website_url'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobSources = pgTable('job_sources', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sourceType: text('source_type').notNull(), // 'remotive_api' | 'arbeitnow_api' | 'jobicy_api' | 'rss_feed' | 'adzuna_api' | 'career_json' | 'manual'
  endpointUrl: text('endpoint_url').notNull(),
  apiKeyEnvVar: text('api_key_env_var'),
  apiConfigJson: jsonb('api_config_json').$type<Record<string, string>>().notNull().default({}),
  enabled: boolean('enabled').notNull().default(true),
  status: text('status').notNull().default('idle'), // 'idle' | 'syncing' | 'healthy' | 'error' | 'needs_config'
  lastSyncedAt: timestamp('last_synced_at'),
  lastError: text('last_error'),
  jobsCollectedCount: integer('jobs_collected_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'set null' }),
  companyName: text('company_name').notNull(),
  companyLogo: text('company_logo'),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  categoryName: text('category_name').notNull(),
  description: text('description').notNull(),
  requirements: text('requirements').notNull(),
  skills: jsonb('skills').$type<string[]>().notNull().default([]),
  employmentType: text('employment_type').notNull().default('Full-time'), // 'Full-time' | 'Part-time' | 'Contract' | 'Internship'
  experienceLevel: text('experience_level').notNull().default('Mid-level'), // 'Entry-level' | 'Graduate' | 'Mid-level' | 'Senior' | 'Lead'
  location: text('location').notNull(),
  workArrangement: text('work_arrangement').notNull().default('Remote'), // 'Remote' | 'Hybrid' | 'Onsite'
  salaryText: text('salary_text'),
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  salaryCurrency: text('salary_currency'),
  publishedAt: timestamp('published_at').notNull().defaultNow(),
  deadlineAt: timestamp('deadline_at'),
  applicationEmail: text('application_email'),
  applicationUrl: text('application_url'),
  applicationInstructions: text('application_instructions'),
  sourceId: integer('source_id').references(() => jobSources.id, { onDelete: 'set null' }),
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url'),
  externalId: text('external_id'),
  dedupHash: text('dedup_hash').notNull(),
  alternateSources: jsonb('alternate_sources').$type<AlternateSource[]>().notNull().default([]),
  status: text('status').notNull().default('unverified'), // 'active' | 'verified' | 'unverified' | 'pending_review' | 'expired'
  isSampleData: boolean('is_sample_data').notNull().default(false),
  lastVerifiedAt: timestamp('last_verified_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const savedJobs = pgTable(
  'saved_jobs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    jobId: integer('job_id')
      .references(() => jobs.id, { onDelete: 'cascade' })
      .notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('saved_jobs_user_job_idx').on(table.userId, table.jobId)]
);

export const jobAlerts = pgTable('job_alerts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  keywords: text('keywords').notNull(),
  categorySlug: text('category_slug'),
  location: text('location'),
  workArrangement: text('work_arrangement').notNull().default('Any'), // 'Any' | 'Remote' | 'Hybrid' | 'Onsite'
  experienceLevel: text('experience_level').notNull().default('Any'),
  frequency: text('frequency').notNull().default('daily'), // 'instant' | 'daily'
  isActive: boolean('is_active').notNull().default(true),
  lastNotifiedAt: timestamp('last_notified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const syncLogs = pgTable('sync_logs', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').references(() => jobSources.id, { onDelete: 'set null' }),
  sourceName: text('source_name').notNull(),
  triggerType: text('trigger_type').notNull().default('manual'), // 'scheduled' | 'manual'
  status: text('status').notNull(), // 'success' | 'partial' | 'failed'
  jobsDiscovered: integer('jobs_discovered').notNull().default(0),
  jobsAdded: integer('jobs_added').notNull().default(0),
  duplicatesMerged: integer('duplicates_merged').notNull().default(0),
  jobsExpired: integer('jobs_expired').notNull().default(0),
  message: text('message'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  syncIntervalHours: integer('sync_interval_hours').notNull().default(2),
  autoExpiryCheckEnabled: boolean('auto_expiry_check_enabled').notNull().default(true),
  expiryDaysThreshold: integer('expiry_days_threshold').notNull().default(45),
  duplicateDetectionEnabled: boolean('duplicate_detection_enabled').notNull().default(true),
  autoVerifyTrustedSources: boolean('auto_verify_trusted_sources').notNull().default(false),
  emailProvider: text('email_provider').notNull().default('none'), // 'none' | 'smtp' | 'resend'
  emailFromAddress: text('email_from_address').notNull().default('onboarding@resend.dev'),
  reviewRecipientEmail: text('review_recipient_email').notNull().default('ebaluegbefodestiny@gmail.com'),
  adminEmails: text('admin_emails').notNull().default('ebaluegbefodestiny@gmail.com'),
  smtpHost: text('smtp_host').default('smtp.resend.com'),
  smtpPort: integer('smtp_port').default(465),
  smtpUser: text('smtp_user').default('resend'),
  emailNotificationsEnabled: boolean('email_notifications_enabled').notNull().default(true),
  demoModeEnabled: boolean('demo_mode_enabled').notNull().default(true),
  autoSyncEnabled: boolean('auto_sync_enabled').notNull().default(true),
  lastScheduledRunAt: timestamp('last_scheduled_run_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notificationLogs = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  recipientEmail: text('recipient_email').notNull(),
  subject: text('subject').notNull(),
  type: text('type').notNull(), // 'job_alert' | 'welcome' | 'saved_reminder' | 'account_update' | 'site_review'
  status: text('status').notNull(), // 'sent' | 'queued_unconfigured' | 'failed'
  errorMessage: text('error_message'),
  matchedJobsCount: integer('matched_jobs_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const siteReviews = pgTable('site_reviews', {
  id: serial('id').primaryKey(),
  reviewerName: text('reviewer_name').notNull(),
  reviewerEmail: text('reviewer_email'),
  rating: integer('rating').notNull().default(5),
  comment: text('comment').notNull(),
  deliveredToEmail: text('delivered_to_email').notNull().default('ebaluegbefodestiny@gmail.com'),
  emailStatus: text('email_status').notNull().default('queued_unconfigured'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  savedJobs: many(savedJobs),
  jobAlerts: many(jobAlerts),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  jobs: many(jobs),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  jobs: many(jobs),
}));

export const jobSourcesRelations = relations(jobSources, ({ many }) => ({
  jobs: many(jobs),
  syncLogs: many(syncLogs),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
  category: one(categories, {
    fields: [jobs.categoryId],
    references: [categories.id],
  }),
  source: one(jobSources, {
    fields: [jobs.sourceId],
    references: [jobSources.id],
  }),
  savedBy: many(savedJobs),
}));

export const savedJobsRelations = relations(savedJobs, ({ one }) => ({
  user: one(users, {
    fields: [savedJobs.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [savedJobs.jobId],
    references: [jobs.id],
  }),
}));

export const jobAlertsRelations = relations(jobAlerts, ({ one }) => ({
  user: one(users, {
    fields: [jobAlerts.userId],
    references: [users.id],
  }),
}));

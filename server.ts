import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, count, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  categories,
  companies,
  jobAlerts,
  jobs,
  jobSources,
  notificationLogs,
  platformSettings,
  savedJobs,
  siteReviews,
  syncLogs,
  users,
} from './src/db/schema.ts';
import { ensureBootstrapData, seedSampleJobs } from './src/db/seed.ts';
import { AuthRequest, optionalAuth, requireAdmin, requireAuth } from './src/middleware/auth.ts';
import {
  computeDedupHash,
  federateLiveSearch,
  getRecentSyncLogs,
  syncJobSources,
  triggerStartupLiveWarmup,
} from './src/services/aggregatorService.ts';
import { dispatchEmail } from './src/services/emailService.ts';
import { expandSearchTerms, scoreJobRelevance } from './src/services/searchService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

// Ensure bootstrap data before handling API routes (lazy on first request, never blocking startup)
app.use('/api', async (_req, _res, next) => {
  try {
    await ensureBootstrapData();
    next();
  } catch (error) {
    console.error('Bootstrap initialization error:', error);
    next(error);
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Public Categories & Job Search Engine
// ---------------------------------------------------------------------------

app.get('/api/categories', async (_req, res) => {
  try {
    const settingsRows = await db
      .select({ demoModeEnabled: platformSettings.demoModeEnabled })
      .from(platformSettings)
      .where(eq(platformSettings.key, 'default'))
      .limit(1);
    const demoModeEnabled = settingsRows[0]?.demoModeEnabled ?? true;

    const allCats = await db.select().from(categories).orderBy(categories.id);
    const countCondition = demoModeEnabled
      ? ne(jobs.status, 'expired')
      : and(ne(jobs.status, 'expired'), eq(jobs.isSampleData, false));

    const activeJobCounts = await db
      .select({
        categoryId: jobs.categoryId,
        total: count(),
      })
      .from(jobs)
      .where(countCondition)
      .groupBy(jobs.categoryId);

    const countMap = new Map(activeJobCounts.map((r) => [r.categoryId, Number(r.total)]));
    const enriched = allCats.map((c) => ({
      ...c,
      jobCount: countMap.get(c.id) ?? 0,
    }));

    res.json({ categories: enriched, demoModeEnabled });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    res.status(500).json({ error: 'Unable to load job categories.' });
  }
});

app.get('/api/jobs', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const settingsRows = await db
      .select({ demoModeEnabled: platformSettings.demoModeEnabled })
      .from(platformSettings)
      .where(eq(platformSettings.key, 'default'))
      .limit(1);
    const demoModeEnabled = settingsRows[0]?.demoModeEnabled ?? true;

    const q = String(req.query.q || '').trim();
    const location = String(req.query.location || '').trim().toLowerCase();
    const categorySlug = String(req.query.category || '').trim();
    const workArrangement = String(req.query.workArrangement || '').trim();
    const employmentType = String(req.query.employmentType || '').trim();
    const experienceLevel = String(req.query.experienceLevel || '').trim();
    const datePosted = String(req.query.datePosted || '').trim();
    const salaryMin = Number(req.query.salaryMin || 0);
    const sort = String(req.query.sort || (q ? 'relevant' : 'recent'));
    const dataOrigin = String(req.query.origin || 'all'); // 'all' | 'live' | 'sample'
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 60)));

    if (q) {
      await federateLiveSearch(q);
    }

    const conditions = [ne(jobs.status, 'expired')];

    if (categorySlug) {
      const catRow = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, categorySlug))
        .limit(1);
      if (catRow[0]) {
        conditions.push(eq(jobs.categoryId, catRow[0].id));
      }
    }

    if (workArrangement && workArrangement !== 'All') {
      conditions.push(eq(jobs.workArrangement, workArrangement));
    }

    if (employmentType && employmentType !== 'All') {
      conditions.push(eq(jobs.employmentType, employmentType));
    }

    if (experienceLevel && experienceLevel !== 'All') {
      conditions.push(eq(jobs.experienceLevel, experienceLevel));
    }

    if (!demoModeEnabled) {
      conditions.push(eq(jobs.isSampleData, false));
    } else if (dataOrigin === 'live') {
      conditions.push(eq(jobs.isSampleData, false));
    } else if (dataOrigin === 'sample') {
      conditions.push(eq(jobs.isSampleData, true));
    }

    if (datePosted) {
      const now = Date.now();
      const msMap: Record<string, number> = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '14d': 14 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      if (msMap[datePosted]) {
        conditions.push(gte(jobs.publishedAt, new Date(now - msMap[datePosted])));
      }
    }

    const candidates = await db
      .select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.publishedAt));

    const expandedTerms = expandSearchTerms(q);

    let filtered = candidates.filter((job) => {
      if (location && !job.location.toLowerCase().includes(location)) {
        return false;
      }
      if (salaryMin > 0) {
        const jobSal = job.salaryMax || job.salaryMin || 0;
        if (jobSal < salaryMin) return false;
      }
      if (q) {
        const score = scoreJobRelevance(job, q, expandedTerms);
        return score > 0;
      }
      return true;
    });

    if (sort === 'relevant' && q) {
      filtered = filtered
        .map((job) => ({
          job,
          score: scoreJobRelevance(job, q, expandedTerms),
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return new Date(b.job.publishedAt).getTime() - new Date(a.job.publishedAt).getTime();
        })
        .map((entry) => entry.job);
    } else if (sort === 'deadline') {
      filtered = [...filtered].sort((a, b) => {
        if (!a.deadlineAt && !b.deadlineAt) return 0;
        if (!a.deadlineAt) return 1;
        if (!b.deadlineAt) return -1;
        return new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime();
      });
    } else {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const paged = filtered.slice(offset, offset + limit);

    let savedIdSet = new Set<number>();
    if (req.dbUser && paged.length > 0) {
      const savedRows = await db
        .select({ jobId: savedJobs.jobId })
        .from(savedJobs)
        .where(
          and(
            eq(savedJobs.userId, req.dbUser.id),
            inArray(
              savedJobs.jobId,
              paged.map((j) => j.id)
            )
          )
        );
      savedIdSet = new Set(savedRows.map((s) => s.jobId));
    }

    res.json({
      jobs: paged.map((j) => ({
        ...j,
        isSaved: savedIdSet.has(j.id),
      })),
      total,
      page,
      totalPages,
      demoModeEnabled,
      expandedTerms: q ? expandedTerms.slice(0, 8) : [],
    });
  } catch (error) {
    console.error('Job search failed:', error);
    res.status(500).json({ error: 'Unable to execute job search.' });
  }
});

app.get('/api/jobs/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const idParam = String(req.params.id);
    const numericId = Number(idParam);
    const rows = Number.isInteger(numericId) && numericId > 0
      ? await db.select().from(jobs).where(eq(jobs.id, numericId)).limit(1)
      : await db.select().from(jobs).where(eq(jobs.slug, idParam)).limit(1);

    const job = rows[0];
    if (!job) {
      return res.status(404).json({ error: 'Job listing not found.' });
    }

    let isSaved = false;
    if (req.dbUser) {
      const saved = await db
        .select({ id: savedJobs.id })
        .from(savedJobs)
        .where(and(eq(savedJobs.userId, req.dbUser.id), eq(savedJobs.jobId, job.id)))
        .limit(1);
      isSaved = saved.length > 0;
    }

    const settingsRows = await db
      .select({ demoModeEnabled: platformSettings.demoModeEnabled })
      .from(platformSettings)
      .where(eq(platformSettings.key, 'default'))
      .limit(1);
    const demoModeEnabled = settingsRows[0]?.demoModeEnabled ?? true;

    const relatedConditions = [
      eq(jobs.categoryName, job.categoryName),
      ne(jobs.id, job.id),
      ne(jobs.status, 'expired'),
    ];
    if (!demoModeEnabled || !job.isSampleData) {
      relatedConditions.push(eq(jobs.isSampleData, false));
    }

    const related = await db
      .select()
      .from(jobs)
      .where(and(...relatedConditions))
      .orderBy(desc(jobs.publishedAt))
      .limit(3);

    res.json({
      job: { ...job, isSaved },
      relatedJobs: related,
    });
  } catch (error) {
    console.error('Failed to fetch job details:', error);
    res.status(500).json({ error: 'Unable to load job details.' });
  }
});

// Public Job Alert Subscription
app.post('/api/alerts/public', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const keywords = String(req.body.keywords || '').trim();
    const categorySlug = req.body.categorySlug ? String(req.body.categorySlug) : null;
    const location = req.body.location ? String(req.body.location).trim() : null;
    const workArrangement = String(req.body.workArrangement || 'Any');
    const experienceLevel = String(req.body.experienceLevel || 'Any');
    const frequency = req.body.frequency === 'instant' ? 'instant' : 'daily';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const inserted = await db
      .insert(jobAlerts)
      .values({
        userId: req.dbUser?.id ?? null,
        email,
        keywords: keywords || 'All roles',
        categorySlug,
        location,
        workArrangement,
        experienceLevel,
        frequency,
        isActive: true,
      })
      .returning();

    const mailResult = await dispatchEmail({
      to: email,
      subject: `Job Alert Confirmed: ${keywords || 'All Roles'} (${frequency})`,
      text: `You are subscribed to ${frequency} job alerts on Kelvs job search for "${keywords || 'All roles'}" (${workArrangement}${location ? ` · ${location}` : ''}).`,
      html: `<div style="font-family:sans-serif;max-width:560px;color:#0f172a;">
        <h2>Job Alert Subscription Active</h2>
        <p>You will receive <strong>${frequency}</strong> updates for:</p>
        <p><strong>Role / Keywords:</strong> ${keywords || 'All roles'}<br/>
        <strong>Arrangement:</strong> ${workArrangement}<br/>
        ${location ? `<strong>Location:</strong> ${location}` : ''}</p>
        <p style="color:#64748b;font-size:12px;">Kelvs job search</p>
      </div>`,
      type: 'welcome',
      matchedJobsCount: 0,
    });

    res.status(201).json({
      alert: inserted[0],
      emailDeliveryStatus: mailResult.status,
      message:
        mailResult.status === 'sent'
          ? 'Alert created and confirmation email sent.'
          : 'Job alert saved. Configure an email delivery provider in Admin Settings to dispatch live outbound emails.',
    });
  } catch (error) {
    console.error('Failed to create public job alert:', error);
    res.status(500).json({ error: 'Unable to save job alert subscription.' });
  }
});

// ---------------------------------------------------------------------------
// Public Website Reviews (Saved in PostgreSQL & Forwarded to Admin Gmail)
// ---------------------------------------------------------------------------

app.get('/api/reviews', async (_req, res) => {
  try {
    const [rows, settingsRows] = await Promise.all([
      db
        .select({
          id: siteReviews.id,
          reviewerName: siteReviews.reviewerName,
          rating: siteReviews.rating,
          comment: siteReviews.comment,
          createdAt: siteReviews.createdAt,
        })
        .from(siteReviews)
        .orderBy(desc(siteReviews.createdAt))
        .limit(50),
      db
        .select({ reviewRecipientEmail: platformSettings.reviewRecipientEmail })
        .from(platformSettings)
        .where(eq(platformSettings.key, 'default'))
        .limit(1),
    ]);

    const totalReviews = rows.length;
    const averageRating =
      totalReviews > 0
        ? Number((rows.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    res.json({
      reviews: rows,
      totalReviews,
      averageRating,
      reviewRecipientEmail:
        settingsRows[0]?.reviewRecipientEmail || 'ebaluegbefodestiny@gmail.com',
    });
  } catch (error) {
    console.error('Failed to load site reviews:', error);
    res.status(500).json({ error: 'Unable to load reviews.' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const reviewerName = String(req.body.reviewerName || '').trim().slice(0, 80);
    const reviewerEmail = req.body.reviewerEmail
      ? String(req.body.reviewerEmail).trim().slice(0, 120)
      : null;
    const rating = Math.min(5, Math.max(1, Number(req.body.rating || 5)));
    const comment = String(req.body.comment || '').trim().slice(0, 1500);

    if (!reviewerName || comment.length < 4) {
      return res.status(400).json({
        error: 'Please enter your name and a short review message (at least 4 characters).',
      });
    }

    const settingsRows = await db
      .select({ reviewRecipientEmail: platformSettings.reviewRecipientEmail })
      .from(platformSettings)
      .where(eq(platformSettings.key, 'default'))
      .limit(1);

    const recipientEmail =
      settingsRows[0]?.reviewRecipientEmail || 'ebaluegbefodestiny@gmail.com';

    const inserted = await db
      .insert(siteReviews)
      .values({
        reviewerName,
        reviewerEmail,
        rating,
        comment,
        deliveredToEmail: recipientEmail,
        emailStatus: 'queued_unconfigured',
      })
      .returning();

    const starText = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    const mailResult = await dispatchEmail({
      to: recipientEmail,
      subject: `New Website Review on Kelvs job search (${rating}/5) from ${reviewerName}`,
      text: `You received a new website review on Kelvs job search.\n\nReviewer: ${reviewerName}${reviewerEmail ? ` (${reviewerEmail})` : ''}\nRating: ${starText} (${rating}/5)\n\nReview:\n${comment}`,
      html: `<div style="font-family:sans-serif;max-width:580px;color:#0f172a;">
        <h2 style="margin-bottom:8px;">New Website Review — Kelvs job search</h2>
        <p style="margin:4px 0;"><strong>Reviewer:</strong> ${reviewerName}${reviewerEmail ? ` (${reviewerEmail})` : ''}</p>
        <p style="margin:4px 0;"><strong>Rating:</strong> ${starText} (${rating}/5)</p>
        <div style="margin-top:14px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <p style="margin:0;white-space:pre-wrap;">${comment}</p>
        </div>
        <p style="color:#64748b;font-size:12px;margin-top:20px;">Kelvs job search Website Reviews</p>
      </div>`,
      type: 'site_review',
      matchedJobsCount: 0,
    });

    const updated = await db
      .update(siteReviews)
      .set({ emailStatus: mailResult.status })
      .where(eq(siteReviews.id, inserted[0].id))
      .returning({
        id: siteReviews.id,
        reviewerName: siteReviews.reviewerName,
        rating: siteReviews.rating,
        comment: siteReviews.comment,
        createdAt: siteReviews.createdAt,
        emailStatus: siteReviews.emailStatus,
      });

    const mailSubject = encodeURIComponent(
      `Website Review for Kelvs job search (${rating}/5) — ${reviewerName}`
    );
    const mailBody = encodeURIComponent(
      `Reviewer: ${reviewerName}${reviewerEmail ? `\nReply Email: ${reviewerEmail}` : ''}\nRating: ${rating}/5\n\nReview:\n${comment}`
    );
    const mailtoFallbackUrl = `mailto:${recipientEmail}?subject=${mailSubject}&body=${mailBody}`;

    res.status(201).json({
      review: updated[0],
      emailStatus: mailResult.status,
      recipientEmail,
      mailtoFallbackUrl,
      message:
        mailResult.status === 'sent'
          ? `Thank you! Your review has been posted and automatically emailed to ${recipientEmail}.`
          : `Thank you! Your review has been posted and saved for ${recipientEmail}.`,
    });
  } catch (error) {
    console.error('Failed to submit website review:', error);
    res.status(500).json({ error: 'Unable to submit review right now.' });
  }
});

// ---------------------------------------------------------------------------
// Authenticated User Profile, Saved Jobs & Alerts
// ---------------------------------------------------------------------------

app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.dbUser });
});

app.put('/api/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = req.dbUser!;
    const displayName = req.body.displayName
      ? String(req.body.displayName).trim().slice(0, 80)
      : dbUser.displayName;
    const preferredCategories = Array.isArray(req.body.preferredCategories)
      ? req.body.preferredCategories.map(String)
      : dbUser.preferredCategories;
    const preferredLocations = Array.isArray(req.body.preferredLocations)
      ? req.body.preferredLocations.map(String)
      : dbUser.preferredLocations;
    const preferredWorkMode = ['any', 'remote', 'hybrid', 'onsite'].includes(
      String(req.body.preferredWorkMode)
    )
      ? String(req.body.preferredWorkMode)
      : dbUser.preferredWorkMode;

    const updated = await db
      .update(users)
      .set({
        displayName,
        preferredCategories,
        preferredLocations,
        preferredWorkMode,
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id))
      .returning();

    res.json({ user: updated[0] });
  } catch (error) {
    console.error('Profile update failed:', error);
    res.status(500).json({ error: 'Unable to update profile preferences.' });
  }
});

app.get('/api/saved-jobs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        savedId: savedJobs.id,
        savedAt: savedJobs.createdAt,
        notes: savedJobs.notes,
        job: jobs,
      })
      .from(savedJobs)
      .innerJoin(jobs, eq(savedJobs.jobId, jobs.id))
      .where(eq(savedJobs.userId, req.dbUser!.id))
      .orderBy(desc(savedJobs.createdAt));

    res.json({
      savedJobs: rows.map((r) => ({
        ...r.job,
        savedAt: r.savedAt,
        notes: r.notes,
        isSaved: true,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch saved jobs:', error);
    res.status(500).json({ error: 'Unable to load saved jobs.' });
  }
});

app.post('/api/saved-jobs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.body.jobId);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return res.status(400).json({ error: 'Valid jobId is required.' });
    }

    const inserted = await db
      .insert(savedJobs)
      .values({
        userId: req.dbUser!.id,
        jobId,
        notes: req.body.notes ? String(req.body.notes).slice(0, 500) : null,
      })
      .onConflictDoNothing()
      .returning();

    res.status(201).json({ saved: true, record: inserted[0] ?? null });
  } catch (error) {
    console.error('Failed to save job:', error);
    res.status(500).json({ error: 'Unable to save job listing.' });
  }
});

app.delete('/api/saved-jobs/:jobId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const jobId = Number(req.params.jobId);
    await db
      .delete(savedJobs)
      .where(and(eq(savedJobs.userId, req.dbUser!.id), eq(savedJobs.jobId, jobId)));
    res.json({ saved: false });
  } catch (error) {
    console.error('Failed to remove saved job:', error);
    res.status(500).json({ error: 'Unable to remove saved job.' });
  }
});

app.get('/api/alerts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(jobAlerts)
      .where(eq(jobAlerts.userId, req.dbUser!.id))
      .orderBy(desc(jobAlerts.createdAt));
    res.json({ alerts: rows });
  } catch (error) {
    console.error('Failed to fetch user alerts:', error);
    res.status(500).json({ error: 'Unable to fetch job alerts.' });
  }
});

app.post('/api/alerts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const keywords = String(req.body.keywords || '').trim();
    if (!keywords) {
      return res.status(400).json({ error: 'Please specify job title or keywords for your alert.' });
    }

    const inserted = await db
      .insert(jobAlerts)
      .values({
        userId: req.dbUser!.id,
        email: req.dbUser!.email,
        keywords,
        categorySlug: req.body.categorySlug ? String(req.body.categorySlug) : null,
        location: req.body.location ? String(req.body.location).trim() : null,
        workArrangement: String(req.body.workArrangement || 'Any'),
        experienceLevel: String(req.body.experienceLevel || 'Any'),
        frequency: req.body.frequency === 'instant' ? 'instant' : 'daily',
        isActive: true,
      })
      .returning();

    res.status(201).json({ alert: inserted[0] });
  } catch (error) {
    console.error('Failed to create user alert:', error);
    res.status(500).json({ error: 'Unable to create job alert.' });
  }
});

app.patch('/api/alerts/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const updates: Partial<typeof jobAlerts.$inferInsert> = {};
    if (typeof req.body.isActive === 'boolean') updates.isActive = req.body.isActive;
    if (req.body.frequency === 'instant' || req.body.frequency === 'daily') {
      updates.frequency = req.body.frequency;
    }

    const updated = await db
      .update(jobAlerts)
      .set(updates)
      .where(and(eq(jobAlerts.id, id), eq(jobAlerts.userId, req.dbUser!.id)))
      .returning();

    if (!updated[0]) return res.status(404).json({ error: 'Alert not found.' });
    res.json({ alert: updated[0] });
  } catch (error) {
    console.error('Failed to update alert:', error);
    res.status(500).json({ error: 'Unable to update job alert.' });
  }
});

app.delete('/api/alerts/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .delete(jobAlerts)
      .where(and(eq(jobAlerts.id, id), eq(jobAlerts.userId, req.dbUser!.id)));
    res.json({ deleted: true });
  } catch (error) {
    console.error('Failed to delete alert:', error);
    res.status(500).json({ error: 'Unable to delete job alert.' });
  }
});

// ---------------------------------------------------------------------------
// Administrator Dashboard API (Protected by requireAuth + requireAdmin)
// ---------------------------------------------------------------------------

app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalJobsRes,
      newTodayRes,
      activeJobsRes,
      expiredJobsRes,
      usersRes,
      sourcesRes,
      recentLogs,
      recentNotifications,
    ] = await Promise.all([
      db.select({ total: count() }).from(jobs),
      db.select({ total: count() }).from(jobs).where(gte(jobs.createdAt, todayStart)),
      db.select({ total: count() }).from(jobs).where(ne(jobs.status, 'expired')),
      db.select({ total: count() }).from(jobs).where(eq(jobs.status, 'expired')),
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(jobSources).where(eq(jobSources.enabled, true)),
      getRecentSyncLogs(12),
      db.select().from(notificationLogs).orderBy(desc(notificationLogs.createdAt)).limit(10),
    ]);

    res.json({
      stats: {
        totalJobs: Number(totalJobsRes[0]?.total ?? 0),
        newToday: Number(newTodayRes[0]?.total ?? 0),
        activeJobs: Number(activeJobsRes[0]?.total ?? 0),
        expiredJobs: Number(expiredJobsRes[0]?.total ?? 0),
        totalUsers: Number(usersRes[0]?.total ?? 0),
        connectedSources: Number(sourcesRes[0]?.total ?? 0),
      },
      recentSyncLogs: recentLogs,
      recentNotifications,
    });
  } catch (error) {
    console.error('Admin overview failed:', error);
    res.status(500).json({ error: 'Unable to load administrator overview.' });
  }
});

app.get('/api/admin/jobs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const statusFilter = String(req.query.status || 'all');
    const q = String(req.query.q || '').trim().toLowerCase();

    const rows =
      statusFilter !== 'all'
        ? await db
            .select()
            .from(jobs)
            .where(eq(jobs.status, statusFilter))
            .orderBy(desc(jobs.createdAt))
            .limit(150)
        : await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(150);

    const filtered = q
      ? rows.filter(
          (j) =>
            j.title.toLowerCase().includes(q) ||
            j.companyName.toLowerCase().includes(q) ||
            j.sourceName.toLowerCase().includes(q)
        )
      : rows;

    res.json({ jobs: filtered });
  } catch (error) {
    console.error('Admin jobs list failed:', error);
    res.status(500).json({ error: 'Unable to load jobs inventory.' });
  }
});

app.post('/api/admin/jobs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const companyName = String(req.body.companyName || '').trim();
    const description = String(req.body.description || '').trim();
    const requirements = String(req.body.requirements || '').trim();
    const location = String(req.body.location || '').trim();

    if (!title || !companyName || !description || !location) {
      return res
        .status(400)
        .json({ error: 'Title, company name, location, and description are required.' });
    }

    const categoryId = req.body.categoryId ? Number(req.body.categoryId) : null;
    let categoryName = String(req.body.categoryName || 'Software Development');
    if (categoryId) {
      const cat = await db
        .select()
        .from(categories)
        .where(eq(categories.id, categoryId))
        .limit(1);
      if (cat[0]) categoryName = cat[0].name;
    }

    const skills = Array.isArray(req.body.skills)
      ? req.body.skills.map(String)
      : String(req.body.skills || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    const slugBase = `${title}-${companyName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

    const inserted = await db
      .insert(jobs)
      .values({
        title,
        slug: `${slugBase}-${Date.now().toString(36)}`,
        companyName,
        companyLogo: req.body.companyLogo ? String(req.body.companyLogo).trim() : null,
        categoryId,
        categoryName,
        description,
        requirements: requirements || description.slice(0, 400),
        skills,
        employmentType: String(req.body.employmentType || 'Full-time'),
        experienceLevel: String(req.body.experienceLevel || 'Mid-level'),
        location,
        workArrangement: String(req.body.workArrangement || 'Remote'),
        salaryText: req.body.salaryText ? String(req.body.salaryText).trim() : null,
        publishedAt: new Date(),
        deadlineAt: req.body.deadlineAt ? new Date(String(req.body.deadlineAt)) : null,
        applicationEmail: req.body.applicationEmail
          ? String(req.body.applicationEmail).trim()
          : null,
        applicationUrl: req.body.applicationUrl ? String(req.body.applicationUrl).trim() : null,
        applicationInstructions: req.body.applicationInstructions
          ? String(req.body.applicationInstructions).trim()
          : null,
        sourceName: String(req.body.sourceName || 'Administrator Direct Listing'),
        sourceUrl: req.body.applicationUrl ? String(req.body.applicationUrl).trim() : null,
        dedupHash: computeDedupHash(title, companyName),
        status: String(req.body.status || 'verified'),
        isSampleData: false,
        lastVerifiedAt: new Date(),
      })
      .returning();

    res.status(201).json({ job: inserted[0] });
  } catch (error) {
    console.error('Admin create job failed:', error);
    res.status(500).json({ error: 'Unable to create job listing.' });
  }
});

app.patch('/api/admin/jobs/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates: Partial<typeof jobs.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof req.body.title === 'string') updates.title = req.body.title.trim();
    if (typeof req.body.companyName === 'string') updates.companyName = req.body.companyName.trim();
    if (typeof req.body.location === 'string') updates.location = req.body.location.trim();
    if (typeof req.body.workArrangement === 'string') {
      updates.workArrangement = req.body.workArrangement;
    }
    if (typeof req.body.employmentType === 'string') {
      updates.employmentType = req.body.employmentType;
    }
    if (typeof req.body.experienceLevel === 'string') {
      updates.experienceLevel = req.body.experienceLevel;
    }
    if (typeof req.body.description === 'string') {
      updates.description = req.body.description.trim();
    }
    if (typeof req.body.requirements === 'string') {
      updates.requirements = req.body.requirements.trim();
    }
    if (Array.isArray(req.body.skills)) {
      updates.skills = req.body.skills.map(String);
    } else if (typeof req.body.skills === 'string') {
      updates.skills = req.body.skills
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    if (req.body.categoryId) {
      const catId = Number(req.body.categoryId);
      const cat = await db.select().from(categories).where(eq(categories.id, catId)).limit(1);
      if (cat[0]) {
        updates.categoryId = cat[0].id;
        updates.categoryName = cat[0].name;
      }
    }
    if (typeof req.body.salaryText === 'string' || req.body.salaryText === null) {
      updates.salaryText = req.body.salaryText;
    }
    if (typeof req.body.applicationEmail === 'string' || req.body.applicationEmail === null) {
      updates.applicationEmail = req.body.applicationEmail;
    }
    if (typeof req.body.applicationUrl === 'string' || req.body.applicationUrl === null) {
      updates.applicationUrl = req.body.applicationUrl;
    }
    if (
      typeof req.body.applicationInstructions === 'string' ||
      req.body.applicationInstructions === null
    ) {
      updates.applicationInstructions = req.body.applicationInstructions;
    }
    if (typeof req.body.companyLogo === 'string' || req.body.companyLogo === null) {
      updates.companyLogo = req.body.companyLogo ? req.body.companyLogo.trim() : null;
    }
    if (req.body.deadlineAt === null || req.body.deadlineAt === '') {
      updates.deadlineAt = null;
    } else if (typeof req.body.deadlineAt === 'string') {
      const parsedDeadline = new Date(req.body.deadlineAt);
      if (!Number.isNaN(parsedDeadline.getTime())) {
        updates.deadlineAt = parsedDeadline;
      }
    }
    if (typeof req.body.isSampleData === 'boolean') {
      updates.isSampleData = req.body.isSampleData;
    }
    if (typeof req.body.status === 'string') {
      updates.status = req.body.status;
      if (req.body.status === 'verified') {
        updates.lastVerifiedAt = new Date();
      }
    }

    const updated = await db
      .update(jobs)
      .set(updates)
      .where(eq(jobs.id, id))
      .returning();

    if (!updated[0]) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job: updated[0] });
  } catch (error) {
    console.error('Admin update job failed:', error);
    res.status(500).json({ error: 'Unable to update job listing.' });
  }
});

app.delete('/api/admin/jobs/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(jobs).where(eq(jobs.id, id));
    res.json({ deleted: true });
  } catch (error) {
    console.error('Admin delete job failed:', error);
    res.status(500).json({ error: 'Unable to delete job listing.' });
  }
});

app.post('/api/admin/jobs/purge-expired', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const deleted = await db
      .delete(jobs)
      .where(eq(jobs.status, 'expired'))
      .returning({ id: jobs.id });
    res.json({ purgedCount: deleted.length });
  } catch (error) {
    console.error('Purge expired failed:', error);
    res.status(500).json({ error: 'Unable to purge expired jobs.' });
  }
});

app.post('/api/admin/demo/restore', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const restoredCount = await seedSampleJobs();
    res.json({ restoredCount });
  } catch (error) {
    console.error('Restore sample jobs failed:', error);
    res.status(500).json({ error: 'Unable to restore sample demo listings.' });
  }
});

app.post('/api/admin/demo/clear', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const deleted = await db
      .delete(jobs)
      .where(eq(jobs.isSampleData, true))
      .returning({ id: jobs.id });
    res.json({ clearedCount: deleted.length });
  } catch (error) {
    console.error('Clear sample jobs failed:', error);
    res.status(500).json({ error: 'Unable to remove sample demo listings.' });
  }
});

app.get('/api/admin/sources', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(jobSources).orderBy(jobSources.id);
    res.json({ sources: rows });
  } catch (error) {
    console.error('Admin sources fetch failed:', error);
    res.status(500).json({ error: 'Unable to fetch job sources.' });
  }
});

app.post('/api/admin/sources', requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const sourceType = String(req.body.sourceType || 'rss_feed').trim();
    const endpointUrl = String(req.body.endpointUrl || '').trim();

    if (!name || !endpointUrl) {
      return res.status(400).json({ error: 'Source name and endpoint URL are required.' });
    }

    const inserted = await db
      .insert(jobSources)
      .values({
        name,
        sourceType,
        endpointUrl,
        apiKeyEnvVar: req.body.apiKeyEnvVar ? String(req.body.apiKeyEnvVar).trim() : null,
        apiConfigJson:
          req.body.apiConfigJson && typeof req.body.apiConfigJson === 'object'
            ? req.body.apiConfigJson
            : {},
        enabled: req.body.enabled !== false,
        status: 'idle',
      })
      .returning();

    res.status(201).json({ source: inserted[0] });
  } catch (error) {
    console.error('Create job source failed:', error);
    res.status(500).json({ error: 'Unable to add job source.' });
  }
});

app.patch('/api/admin/sources/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates: Partial<typeof jobSources.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof req.body.enabled === 'boolean') updates.enabled = req.body.enabled;
    if (typeof req.body.name === 'string') updates.name = req.body.name.trim();
    if (typeof req.body.endpointUrl === 'string') {
      updates.endpointUrl = req.body.endpointUrl.trim();
    }
    if (req.body.apiConfigJson && typeof req.body.apiConfigJson === 'object') {
      updates.apiConfigJson = req.body.apiConfigJson;
    }

    const updated = await db
      .update(jobSources)
      .set(updates)
      .where(eq(jobSources.id, id))
      .returning();

    if (!updated[0]) return res.status(404).json({ error: 'Source not found.' });
    res.json({ source: updated[0] });
  } catch (error) {
    console.error('Update source failed:', error);
    res.status(500).json({ error: 'Unable to update source.' });
  }
});

app.delete('/api/admin/sources/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(jobSources).where(eq(jobSources.id, id));
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete source failed:', error);
    res.status(500).json({ error: 'Unable to delete source.' });
  }
});

app.post('/api/admin/sync', requireAuth, requireAdmin, async (req, res) => {
  try {
    const sourceId = req.body?.sourceId ? Number(req.body.sourceId) : undefined;
    const summary = await syncJobSources({ sourceId, triggerType: 'manual' });
    res.json({ summary });
  } catch (error) {
    console.error('Manual job sync failed:', error);
    res.status(500).json({ error: 'Job synchronization encountered an error.' });
  }
});

function isConfiguredSecret(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  return (
    !upper.startsWith('MY_') &&
    !upper.startsWith('YOUR_') &&
    !upper.includes('PLACEHOLDER') &&
    !upper.includes('CHANGEME')
  );
}

app.get('/api/admin/settings', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'default'))
      .limit(1);

    const currentSettings = rows[0] ?? null;
    const effectiveSmtpHost = currentSettings?.smtpHost || process.env.SMTP_HOST || 'smtp.resend.com';
    const effectiveSmtpUser = currentSettings?.smtpUser || process.env.SMTP_USER || 'resend';
    const hasResendKey = isConfiguredSecret(process.env.RESEND_API_KEY);
    const hasSmtpPass =
      isConfiguredSecret(process.env.SMTP_PASS) ||
      (effectiveSmtpHost === 'smtp.resend.com' && hasResendKey);

    res.json({
      settings: currentSettings,
      credentialsStatus: {
        hasResendKey,
        hasSmtpCredentials: Boolean(effectiveSmtpHost && effectiveSmtpUser && hasSmtpPass),
        hasSmtpPass,
        hasAdzunaCredentials:
          isConfiguredSecret(process.env.ADZUNA_APP_ID) &&
          isConfiguredSecret(process.env.ADZUNA_APP_KEY),
      },
    });
  } catch (error) {
    console.error('Fetch admin settings failed:', error);
    res.status(500).json({ error: 'Unable to load platform settings.' });
  }
});

app.patch('/api/admin/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const updates: Partial<typeof platformSettings.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof req.body.syncIntervalHours === 'number') {
      updates.syncIntervalHours = Math.max(1, Math.min(168, req.body.syncIntervalHours));
    }
    if (typeof req.body.autoExpiryCheckEnabled === 'boolean') {
      updates.autoExpiryCheckEnabled = req.body.autoExpiryCheckEnabled;
    }
    if (typeof req.body.expiryDaysThreshold === 'number') {
      updates.expiryDaysThreshold = Math.max(7, Math.min(180, req.body.expiryDaysThreshold));
    }
    if (typeof req.body.duplicateDetectionEnabled === 'boolean') {
      updates.duplicateDetectionEnabled = req.body.duplicateDetectionEnabled;
    }
    if (typeof req.body.autoVerifyTrustedSources === 'boolean') {
      updates.autoVerifyTrustedSources = req.body.autoVerifyTrustedSources;
    }
    if (typeof req.body.emailProvider === 'string') {
      updates.emailProvider = req.body.emailProvider;
    }
    if (typeof req.body.emailFromAddress === 'string') {
      updates.emailFromAddress = req.body.emailFromAddress.trim();
    }
    if (typeof req.body.smtpHost === 'string' || req.body.smtpHost === null) {
      updates.smtpHost = req.body.smtpHost;
    }
    if (typeof req.body.smtpPort === 'number') {
      updates.smtpPort = req.body.smtpPort;
    }
    if (typeof req.body.smtpUser === 'string' || req.body.smtpUser === null) {
      updates.smtpUser = req.body.smtpUser;
    }
    if (typeof req.body.emailNotificationsEnabled === 'boolean') {
      updates.emailNotificationsEnabled = req.body.emailNotificationsEnabled;
    }
    if (typeof req.body.demoModeEnabled === 'boolean') {
      updates.demoModeEnabled = req.body.demoModeEnabled;
    }
    if (typeof req.body.autoSyncEnabled === 'boolean') {
      updates.autoSyncEnabled = req.body.autoSyncEnabled;
    }
    if (typeof req.body.reviewRecipientEmail === 'string' && req.body.reviewRecipientEmail.includes('@')) {
      updates.reviewRecipientEmail = req.body.reviewRecipientEmail.trim();
    }
    if (typeof req.body.adminEmails === 'string') {
      const parsedEmails = req.body.adminEmails
        .split(',')
        .map((item: string) => item.trim().toLowerCase())
        .filter((item: string) => item.length > 0);
      const invalid = parsedEmails.find((e: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (invalid) {
        return res.status(400).json({ error: `Invalid administrator email format: ${invalid}` });
      }
      const uniqueEmails = Array.from(new Set(parsedEmails));
      updates.adminEmails = uniqueEmails.join(', ');

      if (uniqueEmails.length > 0) {
        await db
          .update(users)
          .set({ role: 'admin', updatedAt: new Date() })
          .where(inArray(sql`lower(${users.email})`, uniqueEmails));
      }
    }

    const updated = await db
      .update(platformSettings)
      .set(updates)
      .where(eq(platformSettings.key, 'default'))
      .returning();

    res.json({ settings: updated[0] });
  } catch (error) {
    console.error('Update admin settings failed:', error);
    res.status(500).json({ error: 'Unable to update platform settings.' });
  }
});

app.get('/api/admin/reviews', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(siteReviews)
      .orderBy(desc(siteReviews.createdAt))
      .limit(100);
    res.json({ reviews: rows });
  } catch (error) {
    console.error('Admin reviews fetch failed:', error);
    res.status(500).json({ error: 'Unable to fetch website reviews.' });
  }
});

app.delete('/api/admin/reviews/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(siteReviews).where(eq(siteReviews.id, id));
    res.json({ deleted: true });
  } catch (error) {
    console.error('Admin delete review failed:', error);
    res.status(500).json({ error: 'Unable to delete review.' });
  }
});

app.post('/api/admin/test-email', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const targetEmail = String(req.body?.email || req.dbUser!.email).trim();
    const result = await dispatchEmail({
      to: targetEmail,
      subject: 'Kelvs job search — Test Notification Delivery',
      text: 'This is a test notification from your Kelvs job search Administrator Dashboard.',
      html: '<p>This is a test notification confirming your Kelvs job search email configuration.</p>',
      type: 'account_update',
      matchedJobsCount: 0,
    });
    res.json(result);
  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({ error: 'Unable to dispatch test email.' });
  }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(100);
    res.json({ users: rows });
  } catch (error) {
    console.error('Fetch users failed:', error);
    res.status(500).json({ error: 'Unable to fetch registered users.' });
  }
});

app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const role = req.body.role === 'admin' ? 'admin' : 'user';
    const updated = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
      });
    res.json({ user: updated[0] });
  } catch (error) {
    console.error('Update user role failed:', error);
    res.status(500).json({ error: 'Unable to update user role.' });
  }
});

// ---------------------------------------------------------------------------
// Scheduled Background Collector (Respects Admin Interval, Lazy Execution)
// ---------------------------------------------------------------------------
const SCHEDULER_CHECK_MS = 5 * 60 * 1000;
let isScheduledSyncRunning = false;

setInterval(async () => {
  if (isScheduledSyncRunning) return;
  try {
    const settingsRows = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'default'))
      .limit(1);
    const settings = settingsRows[0];
    if (!settings || !settings.autoSyncEnabled) return;

    const intervalMs = settings.syncIntervalHours * 60 * 60 * 1000;
    const lastRun = settings.lastScheduledRunAt ? settings.lastScheduledRunAt.getTime() : 0;
    if (Date.now() - lastRun >= intervalMs) {
      isScheduledSyncRunning = true;
      await syncJobSources({ triggerType: 'scheduled' });
    }
  } catch (err) {
    console.error('Scheduled collection check failed:', err);
  } finally {
    isScheduledSyncRunning = false;
  }
}, SCHEDULER_CHECK_MS);

// ---------------------------------------------------------------------------
// Frontend Serving (Vite Dev Middleware or Production Static Dist)
// ---------------------------------------------------------------------------
async function startServer() {
  const port = Number(process.env.PORT || 3000);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Kelvs job search server listening on http://0.0.0.0:${port}`);
    triggerStartupLiveWarmup();
  });
}

startServer();

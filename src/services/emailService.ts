import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { db, isDatabaseReady } from '../db/index.ts';
import { notificationLogs, platformSettings } from '../db/schema.ts';

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
  type: 'job_alert' | 'welcome' | 'saved_reminder' | 'account_update' | 'site_review';
  matchedJobsCount?: number;
}

function isRealSecret(value?: string | null): value is string {
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

async function safeLogNotification(values: typeof notificationLogs.$inferInsert) {
  try {
    if (await isDatabaseReady()) {
      await db.insert(notificationLogs).values(values);
    }
  } catch {
    // Non-fatal in stateless mode
  }
}

export async function dispatchEmail(payload: EmailPayload): Promise<{
  status: 'sent' | 'queued_unconfigured' | 'failed';
  errorMessage?: string;
}> {
  try {
    let settings: typeof platformSettings.$inferSelect | undefined;
    if (await isDatabaseReady()) {
      const settingsRows = await db
        .select()
        .from(platformSettings)
        .where(eq(platformSettings.key, 'default'))
        .limit(1);
      settings = settingsRows[0];
    }

    if (settings && !settings.emailNotificationsEnabled) {
      await safeLogNotification({
        recipientEmail: payload.to,
        subject: payload.subject,
        type: payload.type,
        status: 'queued_unconfigured',
        errorMessage: 'Email notifications are currently disabled in administrator settings.',
        matchedJobsCount: payload.matchedJobsCount ?? 0,
      });
      return {
        status: 'queued_unconfigured',
        errorMessage: 'Email notifications are disabled in settings.',
      };
    }

    const fromAddress =
      settings?.emailFromAddress || process.env.SMTP_FROM || 'onboarding@resend.dev';

    const resendApiKey = isRealSecret(process.env.RESEND_API_KEY)
      ? process.env.RESEND_API_KEY.trim()
      : null;

    const smtpHost = settings?.smtpHost || process.env.SMTP_HOST || 'smtp.resend.com';
    const smtpPort = settings?.smtpPort || Number(process.env.SMTP_PORT || 465);
    const smtpUser = settings?.smtpUser || process.env.SMTP_USER || 'resend';

    // Resend SMTP uses your Resend API key as SMTP_PASS when configured
    const rawSmtpPass = isRealSecret(process.env.SMTP_PASS)
      ? process.env.SMTP_PASS.trim()
      : smtpHost === 'smtp.resend.com' && resendApiKey
        ? resendApiKey
        : null;

    const provider =
      settings?.emailProvider && settings.emailProvider !== 'none'
        ? settings.emailProvider
        : resendApiKey
          ? 'resend'
          : rawSmtpPass
            ? 'smtp'
            : 'none';

    if (provider === 'resend' && resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        await safeLogNotification({
          recipientEmail: payload.to,
          subject: payload.subject,
          type: payload.type,
          status: 'failed',
          errorMessage: `Resend API error (${response.status}): ${errBody.slice(0, 240)}`,
          matchedJobsCount: payload.matchedJobsCount ?? 0,
        });
        return { status: 'failed', errorMessage: `Resend error ${response.status}` };
      }

      await safeLogNotification({
        recipientEmail: payload.to,
        subject: payload.subject,
        type: payload.type,
        status: 'sent',
        matchedJobsCount: payload.matchedJobsCount ?? 0,
      });
      return { status: 'sent' };
    }

    if (provider === 'smtp' && smtpHost && smtpUser && rawSmtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: rawSmtpPass,
        },
      });

      await transporter.sendMail({
        from: fromAddress,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });

      await safeLogNotification({
        recipientEmail: payload.to,
        subject: payload.subject,
        type: payload.type,
        status: 'sent',
        matchedJobsCount: payload.matchedJobsCount ?? 0,
      });
      return { status: 'sent' };
    }

    await safeLogNotification({
      recipientEmail: payload.to,
      subject: payload.subject,
      type: payload.type,
      status: 'queued_unconfigured',
      errorMessage:
        'Email integration is not connected. Add RESEND_API_KEY or SMTP_PASS (your Resend API key) when ready.',
      matchedJobsCount: payload.matchedJobsCount ?? 0,
    });

    return {
      status: 'queued_unconfigured',
      errorMessage: 'Email integration is not connected yet.',
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown email dispatch failure';
    console.error('Email dispatch error:', error);
    try {
      await db.insert(notificationLogs).values({
        recipientEmail: payload.to,
        subject: payload.subject,
        type: payload.type,
        status: 'failed',
        errorMessage: message.slice(0, 240),
        matchedJobsCount: payload.matchedJobsCount ?? 0,
      });
    } catch {
      // Ignore secondary logging failure
    }
    return { status: 'failed', errorMessage: message };
  }
}

export async function sendJobAlertEmail(
  recipientEmail: string,
  alertLabel: string,
  matchedJobs: Array<{
    id: number;
    title: string;
    companyName: string;
    location: string;
    workArrangement: string;
    sourceName: string;
  }>
) {
  const baseUrl = process.env.APP_URL || '';
  const jobLines = matchedJobs
    .slice(0, 8)
    .map(
      (j) =>
        `- ${j.title} at ${j.companyName} (${j.location} · ${j.workArrangement}) [${j.sourceName}]`
    )
    .join('\n');

  const htmlItems = matchedJobs
    .slice(0, 8)
    .map(
      (j) =>
        `<li style="margin-bottom:12px;">
          <strong>${escapeHtml(j.title)}</strong> — ${escapeHtml(j.companyName)}<br/>
          <span style="color:#475569;font-size:13px;">${escapeHtml(j.location)} · ${escapeHtml(j.workArrangement)} · Source: ${escapeHtml(j.sourceName)}</span>
          ${baseUrl ? `<br/><a href="${baseUrl}/?job=${j.id}" style="color:#1d4ed8;">View full listing</a>` : ''}
        </li>`
    )
    .join('');

  return dispatchEmail({
    to: recipientEmail,
    subject: `${matchedJobs.length} new job${matchedJobs.length === 1 ? '' : 's'} matching "${alertLabel}"`,
    text: `New opportunities matching your alert (${alertLabel}):\n\n${jobLines}\n`,
    html: `<div style="font-family:sans-serif;max-width:600px;color:#0f172a;">
      <h2 style="margin-bottom:8px;">New matching opportunities</h2>
      <p style="color:#475569;margin-top:0;">Alert filter: <strong>${escapeHtml(alertLabel)}</strong></p>
      <ul style="padding-left:18px;">${htmlItems}</ul>
      <p style="color:#64748b;font-size:12px;margin-top:24px;">Kelvs job search Automated Alert Service</p>
    </div>`,
    type: 'job_alert',
    matchedJobsCount: matchedJobs.length,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  companies,
  jobSources,
  jobs,
  platformSettings,
} from './schema.ts';
import { computeDedupHash } from '../services/aggregatorService.ts';

export const DEFAULT_CATEGORIES = [
  {
    slug: 'technology-and-it',
    name: 'Technology and IT',
    keywords: ['it', 'cloud', 'devops', 'cybersecurity', 'network', 'sysadmin', 'infrastructure', 'security'],
    description: 'IT infrastructure, cloud operations, cybersecurity, and technical systems roles.',
  },
  {
    slug: 'software-development',
    name: 'Software Development',
    keywords: ['software', 'developer', 'frontend', 'backend', 'full-stack', 'fullstack', 'react', 'web developer', 'typescript', 'python', 'wordpress', 'mobile'],
    description: 'Web, mobile, frontend, backend, and full-stack software engineering positions.',
  },
  {
    slug: 'design-and-creative',
    name: 'Design and Creative',
    keywords: ['design', 'ui/ux', 'ux', 'graphic', 'product designer', 'figma', 'creative', 'brand', 'illustrator'],
    description: 'UI/UX design, graphic design, brand identity, and product design opportunities.',
  },
  {
    slug: 'engineering',
    name: 'Engineering',
    keywords: ['mechanical', 'electrical', 'civil', 'hardware', 'embedded', 'qa engineer', 'robotics', 'manufacturing'],
    description: 'Hardware, electrical, civil, mechanical, and quality engineering roles.',
  },
  {
    slug: 'finance-and-accounting',
    name: 'Finance and Accounting',
    keywords: ['accountant', 'accounting', 'finance', 'financial', 'audit', 'tax', 'payroll', 'bookkeeper', 'cpa'],
    description: 'Accounting, corporate finance, auditing, payroll, and financial analysis roles.',
  },
  {
    slug: 'marketing',
    name: 'Marketing',
    keywords: ['marketing', 'marketer', 'seo', 'sem', 'content', 'growth', 'social media', 'brand', 'copywriter'],
    description: 'Digital marketing, SEO, content strategy, growth, and brand communications.',
  },
  {
    slug: 'sales',
    name: 'Sales',
    keywords: ['sales', 'account executive', 'business development', 'bdr', 'sdr', 'partnerships', 'revenue'],
    description: 'Account executives, business development, and commercial sales roles.',
  },
  {
    slug: 'administration',
    name: 'Administration',
    keywords: ['admin', 'administrative', 'executive assistant', 'office', 'assistant', 'coordinator', 'reception'],
    description: 'Executive assistance, remote administrative support, and office operations.',
  },
  {
    slug: 'customer-service',
    name: 'Customer Service',
    keywords: ['customer support', 'customer service', 'support representative', 'customer success', 'helpdesk', 'support specialist'],
    description: 'Customer support, client success, and technical helpdesk roles.',
  },
  {
    slug: 'education',
    name: 'Education',
    keywords: ['teacher', 'tutor', 'education', 'curriculum', 'instructor', 'professor', 'training', 'learning'],
    description: 'Teaching, instructional design, academic tutoring, and EdTech roles.',
  },
  {
    slug: 'healthcare',
    name: 'Healthcare',
    keywords: ['nurse', 'medical', 'healthcare', 'clinical', 'pharmacy', 'health', 'therapist', 'doctor'],
    description: 'Clinical care, telehealth, nursing, and healthcare administration roles.',
  },
  {
    slug: 'hospitality',
    name: 'Hospitality',
    keywords: ['hospitality', 'hotel', 'restaurant', 'travel', 'tourism', 'chef', 'event', 'guest'],
    description: 'Hotel management, travel operations, culinary, and guest services.',
  },
  {
    slug: 'human-resources',
    name: 'Human Resources',
    keywords: ['hr', 'human resources', 'recruiter', 'talent acquisition', 'people operations', 'compensation'],
    description: 'People operations, talent acquisition, HR generalist, and recruitment roles.',
  },
  {
    slug: 'business-and-management',
    name: 'Business and Management',
    keywords: ['product manager', 'project manager', 'operations', 'strategy', 'analyst', 'data analyst', 'management', 'scrum'],
    description: 'Product management, business analytics, operations, and leadership roles.',
  },
  {
    slug: 'internships-and-graduate-jobs',
    name: 'Internships and Graduate Jobs',
    keywords: ['intern', 'internship', 'graduate', 'apprentice', 'trainee', 'junior', 'entry-level'],
    description: 'Entry-level graduate schemes, apprenticeships, and student internships.',
  },
];

const DEFAULT_SOURCES: Array<typeof jobSources.$inferInsert> = [
  {
    name: 'Remotive Remote Jobs API',
    sourceType: 'remotive_api',
    endpointUrl: 'https://remotive.com/api/remote-jobs?limit=60',
    enabled: true,
    status: 'idle',
    apiConfigJson: {},
  },
  {
    name: 'Arbeitnow Public Job Board',
    sourceType: 'arbeitnow_api',
    endpointUrl: 'https://www.arbeitnow.com/api/job-board-api',
    enabled: true,
    status: 'idle',
    apiConfigJson: {},
  },
  {
    name: 'Jobicy Remote Jobs Feed',
    sourceType: 'jobicy_api',
    endpointUrl: 'https://jobicy.com/api/v2/remote-jobs?count=40',
    enabled: true,
    status: 'idle',
    apiConfigJson: {},
  },
  {
    name: 'RemoteOK Global Jobs API',
    sourceType: 'remoteok_api',
    endpointUrl: 'https://remoteok.com/api',
    enabled: true,
    status: 'idle',
    apiConfigJson: {},
  },
  {
    name: 'Himalayas Remote Jobs API',
    sourceType: 'himalayas_api',
    endpointUrl: 'https://himalayas.app/jobs/api?limit=50',
    enabled: true,
    status: 'idle',
    apiConfigJson: {},
  },
  {
    name: 'We Work Remotely RSS',
    sourceType: 'rss_feed',
    endpointUrl: 'https://weworkremotely.com/remote-jobs.rss',
    enabled: false,
    status: 'idle',
    apiConfigJson: {},
  },
  {
    name: 'Adzuna Job Search API',
    sourceType: 'adzuna_api',
    endpointUrl: 'https://api.adzuna.com/v1/api/jobs/gb/search/1',
    apiKeyEnvVar: 'ADZUNA_APP_ID / ADZUNA_APP_KEY',
    enabled: false,
    status: 'not_connected',
    lastError: null,
    apiConfigJson: { country: 'gb' },
  },
];

let bootstrapPromise: Promise<void> | null = null;

export async function ensureBootstrapData(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

async function runBootstrap(): Promise<void> {
  // 1. Ensure 15 categories exist
  const catCount = await db.select({ total: count() }).from(categories);
  if (Number(catCount[0]?.total ?? 0) === 0) {
    await db
      .insert(categories)
      .values(DEFAULT_CATEGORIES)
      .onConflictDoNothing();
  }

  // 2. Ensure default platform settings exist with known Resend SMTP configuration
  const existingSettings = await db.select().from(platformSettings).limit(1);
  if (existingSettings.length === 0) {
    await db
      .insert(platformSettings)
      .values({
        key: 'default',
        syncIntervalHours: 2,
        autoExpiryCheckEnabled: true,
        expiryDaysThreshold: 45,
        duplicateDetectionEnabled: true,
        autoVerifyTrustedSources: false,
        emailProvider: process.env.RESEND_API_KEY
          ? 'resend'
          : process.env.SMTP_PASS
            ? 'smtp'
            : 'none',
        emailFromAddress: process.env.SMTP_FROM || 'onboarding@resend.dev',
        reviewRecipientEmail: 'ebaluegbefodestiny@gmail.com',
        adminEmails: process.env.ADMIN_EMAILS || 'ebaluegbefodestiny@gmail.com',
        smtpHost: process.env.SMTP_HOST || 'smtp.resend.com',
        smtpPort: Number(process.env.SMTP_PORT || 465),
        smtpUser: process.env.SMTP_USER || 'resend',
        emailNotificationsEnabled: true,
        demoModeEnabled: true,
        autoSyncEnabled: true,
      })
      .onConflictDoNothing();
  } else {
    const current = existingSettings[0];
    const needsSmtpDefaults =
      !current.smtpHost ||
      current.emailFromAddress === 'alerts@kelvsjobsearch.app' ||
      current.emailFromAddress === 'alerts@meridianjobs.app';
    if (needsSmtpDefaults) {
      await db
        .update(platformSettings)
        .set({
          smtpHost: current.smtpHost || process.env.SMTP_HOST || 'smtp.resend.com',
          smtpPort: !current.smtpPort || current.smtpPort === 587 ? Number(process.env.SMTP_PORT || 465) : current.smtpPort,
          smtpUser: current.smtpUser || process.env.SMTP_USER || 'resend',
          emailFromAddress:
            current.emailFromAddress === 'alerts@kelvsjobsearch.app' ||
            current.emailFromAddress === 'alerts@meridianjobs.app'
              ? process.env.SMTP_FROM || 'onboarding@resend.dev'
              : current.emailFromAddress,
          updatedAt: new Date(),
        })
        .where(eq(platformSettings.id, current.id));
    }
  }

  // 3. Ensure external job sources exist (and add RemoteOK + Himalayas if missing)
  const existingSources = await db.select().from(jobSources);
  if (existingSources.length === 0) {
    await db.insert(jobSources).values(DEFAULT_SOURCES);
  } else {
    const existingTypes = new Set(existingSources.map((s) => s.sourceType));
    const missing = DEFAULT_SOURCES.filter((s) => !existingTypes.has(s.sourceType));
    if (missing.length > 0) {
      await db.insert(jobSources).values(missing);
    }
  }

  // 4. Seed clearly-labelled sample reference vacancies only when database has zero jobs
  const jobCount = await db.select({ total: count() }).from(jobs);
  if (Number(jobCount[0]?.total ?? 0) === 0) {
    await seedSampleJobs();
  }
}

export function getSampleListingsTemplate() {
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000);
  const daysAhead = (d: number) => new Date(now + d * 24 * 60 * 60 * 1000);

  return [
      {
        title: 'Website Developer (React & TypeScript)',
        companyName: 'Northstar Digital Studio',
        categorySlug: 'software-development',
        description:
          'Sample reference listing demonstrating structured developer vacancy formatting.\n\nWe are looking for a Website Developer to build responsive marketing websites, web applications, and accessible design systems for SaaS clients. You will collaborate with product designers and backend engineers to ship fast, SEO-friendly interfaces.',
        requirements:
          '• 2+ years building production websites with HTML5, CSS3, TypeScript, and React\n• Familiarity with Next.js, Tailwind CSS, and REST APIs\n• Strong understanding of web accessibility (WCAG AA) and Core Web Vitals',
        skills: ['React', 'TypeScript', 'Tailwind CSS', 'HTML', 'CSS', 'SEO'],
        employmentType: 'Full-time',
        experienceLevel: 'Mid-level',
        location: 'London, United Kingdom',
        workArrangement: 'Remote',
        salaryText: '£48,000 - £62,000 / yr',
        salaryMin: 48000,
        salaryMax: 62000,
        salaryCurrency: 'GBP',
        publishedAt: daysAgo(1),
        deadlineAt: daysAhead(24),
        applicationInstructions:
          'Sample listing: Real external listings display verified employer portals or public recruitment emails.',
        status: 'verified',
      },
      {
        title: 'Junior Frontend Developer',
        companyName: 'Kestrel Commerce Systems',
        categorySlug: 'internships-and-graduate-jobs',
        description:
          'Sample reference listing for entry-level web engineering roles.\n\nJoin our storefront engineering team to craft interactive shopping journeys, modular React components, and responsive storefront layouts.',
        requirements:
          '• Solid foundation in JavaScript (ES6+), React, and semantic HTML\n• Portfolio of web projects or open-source contributions\n• Eagerness to learn automated testing and CI/CD workflows',
        skills: ['JavaScript', 'React', 'CSS', 'Git', 'Tailwind CSS'],
        employmentType: 'Full-time',
        experienceLevel: 'Entry-level',
        location: 'Remote (Europe & UK)',
        workArrangement: 'Remote',
        salaryText: '€36,000 - €44,000 / yr',
        salaryMin: 36000,
        salaryMax: 44000,
        salaryCurrency: 'EUR',
        publishedAt: daysAgo(2),
        deadlineAt: daysAhead(18),
        applicationInstructions: null,
        status: 'verified',
      },
      {
        title: 'WordPress & Web Application Developer',
        companyName: 'Civic Media Partners',
        categorySlug: 'software-development',
        description:
          'Sample reference listing.\n\nMaintain and extend high-traffic editorial WordPress platforms, custom Gutenberg blocks, and headless React web applications.',
        requirements:
          '• Proven experience with WordPress theme/plugin architecture and PHP\n• Modern JavaScript/React familiarity for custom interactive blocks\n• Experience optimising database queries and caching layers',
        skills: ['WordPress', 'JavaScript', 'React', 'SQL', 'HTML'],
        employmentType: 'Contract',
        experienceLevel: 'Mid-level',
        location: 'Manchester, UK',
        workArrangement: 'Hybrid',
        salaryText: '£350 - £420 / day',
        salaryMin: 70000,
        salaryMax: 84000,
        salaryCurrency: 'GBP',
        publishedAt: daysAgo(3),
        deadlineAt: daysAhead(15),
        applicationInstructions: null,
        status: 'active',
      },
      {
        title: 'Backend Software Engineer (Node.js & PostgreSQL)',
        companyName: 'LedgerFlow Infrastructure',
        categorySlug: 'software-development',
        description:
          'Sample reference listing.\n\nArchitect resilient payment webhooks, relational PostgreSQL data models, and low-latency REST APIs powering B2B treasury workflows.',
        requirements:
          '• 3+ years with Node.js/TypeScript, Express or Fastify, and PostgreSQL\n• Deep knowledge of database indexing, transactions, and query optimisation\n• Experience deploying containerised services on cloud platforms',
        skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST API', 'Docker'],
        employmentType: 'Full-time',
        experienceLevel: 'Senior',
        location: 'Berlin, Germany',
        workArrangement: 'Hybrid',
        salaryText: '€72,000 - €88,000 / yr',
        salaryMin: 72000,
        salaryMax: 88000,
        salaryCurrency: 'EUR',
        publishedAt: daysAgo(1),
        deadlineAt: daysAhead(30),
        applicationInstructions: null,
        status: 'verified',
      },
      {
        title: 'UI/UX & Product Designer',
        companyName: 'Harborline Health Tech',
        categorySlug: 'design-and-creative',
        description:
          'Sample reference listing.\n\nLead end-to-end user research, wireframing, and design system governance for our clinician scheduling and patient intake platform.',
        requirements:
          '• 3+ years designing complex B2B or healthcare SaaS web applications\n• Mastery of Figma component libraries, auto-layout, and interactive prototyping\n• Strong accessibility mindset and portfolio demonstrating measurable UX outcomes',
        skills: ['Figma', 'UI/UX', 'Design Systems', 'Prototyping', 'User Research'],
        employmentType: 'Full-time',
        experienceLevel: 'Mid-level',
        location: 'Remote (Global)',
        workArrangement: 'Remote',
        salaryText: '$95,000 - $118,000 / yr',
        salaryMin: 95000,
        salaryMax: 118000,
        salaryCurrency: 'USD',
        publishedAt: daysAgo(2),
        deadlineAt: daysAhead(21),
        applicationInstructions: null,
        status: 'verified',
      },
      {
        title: 'Graphic Designer (Brand & Editorial)',
        companyName: 'Alder Publishing House',
        categorySlug: 'design-and-creative',
        description:
          'Sample reference listing.\n\nCreate print-ready editorial layouts, digital campaign graphics, social assets, and typography systems for our quarterly publications.',
        requirements:
          '• Proficiency in Adobe Creative Cloud (InDesign, Illustrator, Photoshop) and Figma\n• Strong typographic craft and visual hierarchy portfolio\n• Experience collaborating with editorial and marketing teams',
        skills: ['Graphic Design', 'Typography', 'Illustrator', 'Figma', 'Branding'],
        employmentType: 'Part-time',
        experienceLevel: 'Mid-level',
        location: 'Bristol, UK',
        workArrangement: 'Onsite',
        salaryText: '£28,000 - £34,000 pro rata',
        salaryMin: 28000,
        salaryMax: 34000,
        salaryCurrency: 'GBP',
        publishedAt: daysAgo(4),
        deadlineAt: daysAhead(12),
        applicationInstructions: null,
        status: 'active',
      },
      {
        title: 'Data Analyst (SQL & Business Intelligence)',
        companyName: 'Meridian Retail Group',
        categorySlug: 'business-and-management',
        description:
          'Sample reference listing.\n\nTurn multi-channel retail telemetry into actionable executive dashboards, cohort retention analyses, and inventory forecasting models.',
        requirements:
          '• Advanced SQL querying skills (PostgreSQL / BigQuery)\n• Experience building executive dashboards in Looker, Tableau, or Power BI\n• Clear written and verbal communication with non-technical stakeholders',
        skills: ['SQL', 'PostgreSQL', 'Python', 'Excel', 'Analytics'],
        employmentType: 'Full-time',
        experienceLevel: 'Mid-level',
        location: 'Amsterdam, Netherlands',
        workArrangement: 'Hybrid',
        salaryText: '€54,000 - €66,000 / yr',
        salaryMin: 54000,
        salaryMax: 66000,
        salaryCurrency: 'EUR',
        publishedAt: daysAgo(1),
        deadlineAt: daysAhead(20),
        applicationInstructions: null,
        status: 'verified',
      },
      {
        title: 'Cybersecurity Analyst (SOC & Cloud Security)',
        companyName: 'Aegis Trust Networks',
        categorySlug: 'technology-and-it',
        description:
          'Sample reference listing.\n\nMonitor security alerts across cloud infrastructure, triage potential threats, conduct vulnerability assessments, and strengthen IAM policies.',
        requirements:
          '• 2+ years in security operations, incident response, or cloud security\n• Familiarity with SIEM tooling, AWS/GCP security controls, and OWASP standards\n• Industry certifications (Security+, CySA+, or equivalent) advantageous',
        skills: ['Cybersecurity', 'SIEM', 'AWS', 'Network Security', 'Compliance'],
        employmentType: 'Full-time',
        experienceLevel: 'Mid-level',
        location: 'Remote (UK / EU)',
        workArrangement: 'Remote',
        salaryText: '£55,000 - £70,000 / yr',
        salaryMin: 55000,
        salaryMax: 70000,
        salaryCurrency: 'GBP',
        publishedAt: daysAgo(3),
        deadlineAt: daysAhead(28),
        applicationInstructions: null,
        status: 'verified',
      },
      {
        title: 'Digital Marketer (SEO & Growth)',
        companyName: 'Beacon Learning Labs',
        categorySlug: 'marketing',
        description:
          'Sample reference listing.\n\nOwn organic search acquisition, technical SEO audits, content distribution, and paid search experiments for our online courses platform.',
        requirements:
          '• Hands-on experience with Google Analytics 4, Search Console, and Ahrefs/SEMrush\n• Proven track record scaling organic traffic and conversion funnels\n• Strong copywriting and data-backed experimentation habits',
        skills: ['SEO', 'Google Analytics', 'Content Marketing', 'Growth', 'SEM'],
        employmentType: 'Full-time',
        experienceLevel: 'Mid-level',
        location: 'Dublin, Ireland',
        workArrangement: 'Remote',
        salaryText: '€46,000 - €56,000 / yr',
        salaryMin: 46000,
        salaryMax: 56000,
        salaryCurrency: 'EUR',
        publishedAt: daysAgo(5),
        deadlineAt: daysAhead(16),
        applicationInstructions: null,
        status: 'active',
      },
      {
        title: 'Management Accountant',
        companyName: 'Clearview Logistics Ltd',
        categorySlug: 'finance-and-accounting',
        description:
          'Sample reference listing.\n\nPrepare monthly management accounts, variance reporting, VAT returns, and cash-flow forecasts across European distribution hubs.',
        requirements:
          '• Part-qualified or fully qualified accountant (ACCA, CIMA, ACA, or CPA)\n• Strong Excel modelling and ERP reconciliation experience\n• Attention to regulatory compliance and audit readiness',
        skills: ['Accounting', 'Excel', 'Financial Reporting', 'Audit', 'Tax'],
        employmentType: 'Full-time',
        experienceLevel: 'Mid-level',
        location: 'Birmingham, UK',
        workArrangement: 'Onsite',
        salaryText: '£42,000 - £50,000 / yr',
        salaryMin: 42000,
        salaryMax: 50000,
        salaryCurrency: 'GBP',
        publishedAt: daysAgo(4),
        deadlineAt: daysAhead(22),
        applicationInstructions: null,
        status: 'verified',
      },
      {
        title: 'Customer Support Representative',
        companyName: 'ClearCloud Workspace',
        categorySlug: 'customer-service',
        description:
          'Sample reference listing.\n\nDeliver empathetic, accurate email and live-chat support to SaaS teams worldwide, troubleshoot account questions, and document product feedback.',
        requirements:
          '• Excellent written English communication and calm problem-solving skills\n• Experience with helpdesk software (Zendesk, Intercom, or Help Scout)\n• Comfortable working asynchronously in a distributed remote team',
        skills: ['Customer Support', 'CRM', 'Troubleshooting', 'Written Communication'],
        employmentType: 'Full-time',
        experienceLevel: 'Entry-level',
        location: 'Remote (Worldwide)',
        workArrangement: 'Remote',
        salaryText: '$38,000 - $46,000 / yr',
        salaryMin: 38000,
        salaryMax: 46000,
        salaryCurrency: 'USD',
        publishedAt: daysAgo(2),
        deadlineAt: daysAhead(19),
        applicationInstructions: null,
        status: 'verified',
      },
      {
        title: 'Remote Executive & Operations Assistant',
        companyName: 'Foundry Ventures Collective',
        categorySlug: 'administration',
        description:
          'Sample reference listing.\n\nCoordinate executive calendars, travel logistics, board meeting briefs, and vendor invoicing for a remote leadership team.',
        requirements:
          '• 2+ years supporting executives or remote operations teams\n• Fluency in Google Workspace, Notion, and Slack workflows\n• High discretion, organisation, and proactive follow-through',
        skills: ['Administration', 'Scheduling', 'Google Workspace', 'Operations'],
        employmentType: 'Part-time',
        experienceLevel: 'Mid-level',
        location: 'Remote (EMEA Timezones)',
        workArrangement: 'Remote',
        salaryText: '$24 - $32 / hr',
        salaryMin: 25000,
        salaryMax: 34000,
        salaryCurrency: 'USD',
        publishedAt: daysAgo(3),
        deadlineAt: daysAhead(14),
        applicationInstructions: null,
        status: 'active',
      },
      {
        title: 'Graduate Software Engineering Internship',
        companyName: 'Stratos Robotics Lab',
        categorySlug: 'internships-and-graduate-jobs',
        description:
          'Sample reference listing.\n\nA 12-week paid summer/graduate engineering placement working alongside senior mentors on web telemetry dashboards and Python simulation tools.',
        requirements:
          '• Final-year undergraduate, recent graduate, or coding bootcamp completer\n• Familiarity with Python or TypeScript/React\n• Clear curiosity for software architecture and collaborative code reviews',
        skills: ['Python', 'TypeScript', 'React', 'Git'],
        employmentType: 'Internship',
        experienceLevel: 'Graduate',
        location: 'Edinburgh, UK',
        workArrangement: 'Hybrid',
        salaryText: '£26,000 pro rata',
        salaryMin: 26000,
        salaryMax: 28000,
        salaryCurrency: 'GBP',
        publishedAt: daysAgo(1),
        deadlineAt: daysAhead(35),
        applicationInstructions: null,
        status: 'verified',
      },
    ];
}

export async function seedSampleJobs(): Promise<number> {
  const allCats = await db.select().from(categories);
  const catBySlug = new Map(allCats.map((c) => [c.slug, c]));
  const sampleListings = getSampleListingsTemplate();

  let insertedCount = 0;
    for (let i = 0; i < sampleListings.length; i++) {
      const item = sampleListings[i];
      const cat = catBySlug.get(item.categorySlug) || allCats[0];
      const companySlug = item.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const insertedCompany = await db
        .insert(companies)
        .values({
          name: item.companyName,
          slug: companySlug,
        })
        .onConflictDoUpdate({
          target: companies.slug,
          set: { name: item.companyName },
        })
        .returning();

      const slug = `sample-${companySlug}-${i + 1}`;
      const res = await db
        .insert(jobs)
        .values({
          title: item.title,
          slug,
          companyId: insertedCompany[0]?.id ?? null,
          companyName: item.companyName,
          categoryId: cat?.id ?? null,
          categoryName: cat?.name ?? 'Software Development',
          description: item.description,
          requirements: item.requirements,
          skills: item.skills,
          employmentType: item.employmentType,
          experienceLevel: item.experienceLevel,
          location: item.location,
          workArrangement: item.workArrangement,
          salaryText: item.salaryText,
          salaryMin: item.salaryMin,
          salaryMax: item.salaryMax,
          salaryCurrency: item.salaryCurrency,
          publishedAt: item.publishedAt,
          deadlineAt: item.deadlineAt,
          applicationEmail: null,
          applicationUrl: null,
          applicationInstructions: item.applicationInstructions,
          sourceName: 'Sample Reference Listing',
          sourceUrl: null,
          externalId: slug,
          dedupHash: computeDedupHash(item.title, item.companyName),
          alternateSources: [],
          status: item.status,
          isSampleData: true,
          lastVerifiedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: jobs.id });
      if (res.length > 0) insertedCount += 1;
    }
  return insertedCount;
}

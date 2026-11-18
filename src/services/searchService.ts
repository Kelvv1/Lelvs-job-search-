const ROLE_SYNONYMS: Array<{ triggers: string[]; terms: string[] }> = [
  {
    triggers: ['website development', 'website developer', 'web development', 'web developer', 'web dev', 'website'],
    terms: [
      'website development',
      'website developer',
      'web development',
      'web developer',
      'frontend developer',
      'front-end',
      'full-stack',
      'fullstack',
      'react developer',
      'wordpress',
      'webflow',
      'shopify',
      'web application',
      'next.js',
      'javascript',
      'typescript',
      'html',
      'css',
    ],
  },
  {
    triggers: ['app development', 'app developer', 'mobile app', 'mobile developer', 'android', 'ios', 'flutter', 'react native'],
    terms: [
      'app development',
      'app developer',
      'mobile developer',
      'mobile engineer',
      'mobile app',
      'ios developer',
      'android developer',
      'react native',
      'flutter',
      'swift',
      'kotlin',
      'dart',
      'xamarin',
    ],
  },
  {
    triggers: ['frontend', 'front-end', 'front end', 'react', 'vue', 'angular'],
    terms: [
      'frontend',
      'front-end',
      'react',
      'typescript',
      'javascript',
      'next.js',
      'vue',
      'angular',
      'web developer',
      'ui developer',
      'tailwind',
    ],
  },
  {
    triggers: ['backend', 'back-end', 'back end', 'node', 'api developer'],
    terms: [
      'backend',
      'back-end',
      'node.js',
      'python',
      'java',
      'golang',
      'postgresql',
      'sql',
      'api',
      'microservices',
      'express',
      'django',
      'fastapi',
    ],
  },
  {
    triggers: ['full stack', 'full-stack', 'fullstack', 'software engineer', 'software developer'],
    terms: [
      'software engineer',
      'software developer',
      'full-stack',
      'fullstack',
      'web developer',
      'frontend',
      'backend',
      'typescript',
      'python',
      'react',
      'node.js',
    ],
  },
  {
    triggers: ['graphic design', 'graphic designer', 'visual design', 'brand design', 'photoshop', 'illustrator'],
    terms: [
      'graphic design',
      'graphic designer',
      'visual designer',
      'brand designer',
      'creative designer',
      'illustrator',
      'photoshop',
      'indesign',
      'canva',
      'figma',
      'motion graphics',
      'ui/ux',
      'art director',
    ],
  },
  {
    triggers: ['ui/ux', 'ux', 'ui designer', 'product designer'],
    terms: [
      'ui/ux',
      'ux designer',
      'ui designer',
      'product designer',
      'graphic designer',
      'figma',
      'visual designer',
      'brand designer',
      'interaction design',
      'design systems',
    ],
  },
  {
    triggers: ['video editor', 'video editing', 'motion designer', 'content creator'],
    terms: [
      'video editor',
      'video editing',
      'premiere',
      'after effects',
      'motion graphics',
      'youtube',
      'multimedia',
      'content creator',
    ],
  },
  {
    triggers: ['data analyst', 'data science', 'analytics', 'business intelligence'],
    terms: [
      'data analyst',
      'data analytics',
      'business intelligence',
      'sql',
      'tableau',
      'power bi',
      'python',
      'excel',
      'reporting',
      'data scientist',
    ],
  },
  {
    triggers: ['cybersecurity', 'security analyst', 'infosec', 'soc'],
    terms: [
      'cybersecurity',
      'security analyst',
      'information security',
      'infosec',
      'soc analyst',
      'penetration',
      'siem',
      'network security',
      'cloud security',
      'compliance',
    ],
  },
  {
    triggers: ['devops', 'cloud engineer', 'sre', 'infrastructure'],
    terms: [
      'devops',
      'cloud engineer',
      'site reliability',
      'sre',
      'aws',
      'kubernetes',
      'docker',
      'terraform',
      'ci/cd',
    ],
  },
  {
    triggers: ['digital marketer', 'digital marketing', 'marketing', 'seo', 'growth', 'social media'],
    terms: [
      'digital marketer',
      'digital marketing',
      'seo',
      'sem',
      'growth marketing',
      'content marketing',
      'performance marketing',
      'social media',
      'ppc',
      'copywriter',
    ],
  },
  {
    triggers: ['accountant', 'accounting', 'finance', 'bookkeeper'],
    terms: [
      'accountant',
      'accounting',
      'bookkeeper',
      'financial analyst',
      'audit',
      'payroll',
      'tax',
      'cpa',
      'acca',
      'controller',
    ],
  },
  {
    triggers: ['customer support', 'customer service', 'support representative', 'helpdesk'],
    terms: [
      'customer support',
      'customer service',
      'support representative',
      'technical support',
      'customer success',
      'helpdesk',
      'client support',
    ],
  },
  {
    triggers: ['remote assistant', 'virtual assistant', 'executive assistant', 'admin assistant'],
    terms: [
      'remote assistant',
      'virtual assistant',
      'executive assistant',
      'administrative assistant',
      'operations assistant',
      'office coordinator',
    ],
  },
  {
    triggers: ['sales', 'account executive', 'business development', 'sdr', 'bdr'],
    terms: [
      'sales',
      'account executive',
      'business development',
      'sdr',
      'bdr',
      'partnerships',
      'revenue',
    ],
  },
  {
    triggers: ['project manager', 'product manager', 'scrum master', 'operations'],
    terms: [
      'project manager',
      'product manager',
      'program manager',
      'scrum master',
      'product owner',
      'operations manager',
    ],
  },
];

const GENERIC_QUERY_STOP_WORDS = new Set([
  'job',
  'jobs',
  'role',
  'roles',
  'work',
  'remote',
  'developer',
  'development',
  'designer',
  'design',
  'engineer',
  'manager',
  'specialist',
  'assistant',
  'for',
  'and',
  'the',
  'with',
]);

export function expandSearchTerms(query: string): string[] {
  const cleaned = query.trim().toLowerCase();
  if (!cleaned) return [];

  const expanded = new Set<string>([cleaned]);
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2);
  for (const token of tokens) {
    if (!GENERIC_QUERY_STOP_WORDS.has(token) || tokens.length === 1) {
      expanded.add(token);
    }
  }

  for (const group of ROLE_SYNONYMS) {
    const matchesTrigger = group.triggers.some(
      (trigger) => cleaned.includes(trigger) || trigger.includes(cleaned)
    );
    if (matchesTrigger) {
      for (const term of group.terms) {
        expanded.add(term);
      }
    }
  }

  return Array.from(expanded);
}

export function scoreJobRelevance(
  job: {
    title: string;
    companyName: string;
    description: string;
    requirements: string;
    skills: string[];
    categoryName: string;
    location: string;
  },
  rawQuery: string,
  expandedTerms: string[]
): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 0;

  const title = job.title.toLowerCase();
  const company = job.companyName.toLowerCase();
  const skills = (job.skills || []).join(' ').toLowerCase();
  const category = job.categoryName.toLowerCase();
  const body = `${job.description} ${job.requirements}`.toLowerCase();

  let score = 0;

  if (title === q) score += 140;
  else if (title.includes(q)) score += 90;

  if (company.includes(q)) score += 45;
  if (skills.includes(q)) score += 45;
  if (category.includes(q)) score += 28;
  if (body.includes(q)) score += 24;

  // Multi-word exact token check (boosts when all significant query tokens appear)
  const rawTokens = q.split(/\s+/).filter((t) => t.length >= 2);
  if (rawTokens.length > 1) {
    const matchedTokens = rawTokens.filter(
      (t) => title.includes(t) || skills.includes(t) || body.includes(t)
    );
    if (matchedTokens.length === rawTokens.length) {
      score += 55;
    } else if (matchedTokens.length > 0 && score === 0) {
      // Allow partial token matches only if at least one non-generic token matched
      const specificMatched = matchedTokens.some((t) => !GENERIC_QUERY_STOP_WORDS.has(t));
      if (specificMatched) {
        score += 14 * matchedTokens.length;
      }
    }
  }

  for (const term of expandedTerms) {
    if (term === q) continue;
    if (title.includes(term)) score += 32;
    if (skills.includes(term)) score += 18;
    if (category.includes(term)) score += 10;
    if (body.includes(term)) score += 6;
  }

  return score;
}

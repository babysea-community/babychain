import { createFontAwesomeIcon } from '@/components/icons/font-awesome-icon';
import { InlineGitHub } from '@/components/icons/inline-git';
import { InlineSentry } from '@/components/icons/inline-sponsor';
import type { ModelChainCatalogEntry } from '@/lib/chains/catalog';
import type { ModelCatalogEntry } from '@/lib/models/model-catalog';

const ChartLine = createFontAwesomeIcon('chart-line');
const CodeFork = createFontAwesomeIcon('code-fork');
const Database = createFontAwesomeIcon('database');
const Fingerprint = createFontAwesomeIcon('fingerprint');
const Flag = createFontAwesomeIcon('flag');
const Heart = createFontAwesomeIcon('heart');
const Key = createFontAwesomeIcon('key');
const Lock = createFontAwesomeIcon('lock');
const Microchip = createFontAwesomeIcon('microchip');
const Rocket = createFontAwesomeIcon('rocket');
const Share = createFontAwesomeIcon('share');
const ShieldHalved = createFontAwesomeIcon('shield-halved');
const Terminal = createFontAwesomeIcon('terminal');
const UserAstronaut = createFontAwesomeIcon('user-astronaut');
const UserSecret = createFontAwesomeIcon('user-secret');
const UserShield = createFontAwesomeIcon('user-shield');

export const siteNavigation = {
  brand: 'BabyChain',
  homeHref: '/',
  actions: [
    {
      href: 'https://github.com/babysea-community/babychain',
      icon: InlineGitHub,
      label: 'GitHub',
      variant: 'outline' as const,
    },
    {
      href: 'https://github.com/sponsors/babysea-community',
      icon: Heart,
      label: 'Sponsor',
      tone: 'sponsor' as const,
      variant: 'default' as const,
    },
    {
      href: '/login',
      icon: UserShield,
      label: 'Owner access',
      variant: 'outline' as const,
    },
  ],
};

export const homepageHero = {
  eyebrow: 'Canvas studio + Agentic Chain API',
  title: 'Every output becomes the next input.',
  description:
    'Compose image and video model chains on a visual canvas, then run the same flows through a durable self-hosted API with one final callback.',
  actions: [
    {
      href: '/templates',
      icon: Rocket,
      label: 'Explore templates',
      variant: 'outline' as const,
    },
  ],
  preview: {
    command: 'POST /api/v1/chains/runs',
    route: '/api/v1/chains/runs',
    status: 'ready',
  },
  pipeline: {
    label: 'BabyChain run path',
    nodes: [
      'request',
      'image output',
      'handoff URL',
      'video output',
      'callback',
    ],
  },
  console: {
    title: 'BabyChain workflow',
    deployTitle: 'BabyChain deployment',
    lines: [
      'load the requested chain template',
      'verify scoped caller identity',
      'resolve BYOK inference credentials',
      'draft each next action with an agentic planner',
      'approve copilot checkpoints or release autopilot',
      'persist durable runs and ordered records',
      'execute steps, hand off outputs, send signed callback',
    ],
    deployLinks: [
      {
        href: 'https://github.com/babysea-community/babychain/blob/main/docs/deployment/aws-cloudformation.md',
        label: 'AWS CloudFormation',
      },
      {
        href: 'https://github.com/babysea-community/babychain/blob/main/docs/deployment/aws-ec2.md',
        label: 'AWS EC2',
      },
      {
        href: 'https://deploy.workers.cloudflare.com/?url=https://github.com/babysea-community/babychain',
        label: 'Cloudflare',
        status: 'under-development' as const,
      },
      {
        href: 'https://github.com/babysea-community/babychain/blob/main/docs/deployment/coolify.md',
        label: 'Coolify',
      },
      {
        href: 'https://cloud.digitalocean.com/apps/new?repo=https://github.com/babysea-community/babychain/tree/main',
        label: 'DigitalOcean',
        status: 'under-development' as const,
      },
      {
        href: 'https://github.com/babysea-community/babychain/blob/main/docs/deployment/docker.md',
        label: 'Docker',
      },
      {
        href: 'https://github.com/babysea-community/babychain/blob/main/docs/deployment/fly-io.md',
        label: 'Fly.io',
      },
      {
        href: 'https://github.com/babysea-community/babychain/blob/main/docs/deployment/google-cloud-run.md',
        label: 'Google Cloud Run',
      },
      {
        href: 'https://app.netlify.com/start/deploy?repository=https://github.com/babysea-community/babychain',
        label: 'Netlify',
        status: 'under-development' as const,
      },
      {
        href: 'https://railway.com/deploy/babychain?referralCode=_FJpRb',
        label: 'Railway',
        status: 'under-development' as const,
      },
      {
        href: 'https://render.com/deploy?repo=https://github.com/babysea-community/babychain',
        label: 'Render',
        status: 'under-development' as const,
      },
      {
        href: 'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fbabysea-community%2Fbabychain&project-name=babychain&repository-name=babychain&env=NEXT_PUBLIC_SITE_URL,OWNER_EMAIL,OWNER_PASSWORD,OWNER_SESSION_SECRET,DATABASE_URL,BABYCHAIN_API_KEY,BABYCHAIN_CRON_SECRET,BABYCHAIN_CALLBACK_SECRET,BABYCHAIN_PROVIDER_MODE,DASHSCOPE_API_KEY,BFL_API_KEY,BFL_REGION,BFL_API_BASE_URL,ARK_API_KEY,GEMINI_API_KEY,OPENAI_API_KEY,RUNWAYML_API_SECRET',
        label: 'Vercel',
      },
    ],
  },
};

export const catalogIntro = {
  eyebrow: 'Chain templates',
  title: 'Orchestrate model-to-model workflows.',
  description:
    'BabyChain runs chained image and video steps where each output can be transformed, restyled, or extended before one final callback.',
  apiHostLabel: 'Host and run BabyChain',
  modelCatalogLabel: 'Inference providers',
};

export const providerModes = {
  eyebrow: 'Provider modes',
  title: 'Self-hosted with your own keys and environment.',
  description:
    'Run BabyChain in either mode: BYOK connects to your providers directly; BabySea mode uses your BabySea API key behind the same API contract.',
  footnote:
    'Caller apps keep using BabyChain API keys either way; provider credentials stay inside your backend.',
  modes: [
    {
      env: 'BABYCHAIN_PROVIDER_MODE=byok',
      icon: Key,
      label: 'Direct inference access',
      text: 'Connect your inference provider credentials. Your BabyChain deployment owns model access, provider settings, and orchestration.',
      title: 'BYOK mode',
    },
    {
      env: 'BABYCHAIN_PROVIDER_MODE=babysea',
      icon: Lock,
      label: 'Managed execution path',
      text: 'Use one BabySea API key for supported chain execution while keeping BabyChain routes, callbacks, and template contracts unchanged.',
      title: 'BabySea mode',
    },
  ],
};

export const agenticWorkflow = {
  eyebrow: 'Agentic Workflow',
  title: 'Design and chain your canvas with an agentic planner.',
  description:
    'Lay out a chain on the canvas, then let an agentic planner read the previous output, the chain context, and the model schema to propose the next step. Approve each checkpoint in Copilot, or hand it the wheel on Autopilot.',
  modelLabel: 'Planner model',
  modelName: 'Amazon Nova',
  storageLabel: 'Storage providers',
  features: [
    {
      icon: UserAstronaut,
      label: 'Agentic · Copilot',
      title: 'Approve every step',
      text: 'Copilot proposes the prompt and fields for the next step; you lock the values and approve before it runs.',
    },
    {
      icon: UserSecret,
      label: 'Agentic · Autopilot',
      title: 'Run the whole chain',
      text: 'Autopilot applies each planned step automatically and hands every output to the next model.',
    },
  ],
};

export const databaseEngine = {
  eyebrow: 'Persistence layer',
  title: 'Persist and replay every run on a durable database.',
  description:
    'Every run, step, checkpoint, and output is written to a durable Postgres database, so retries stay idempotent and any paused run resumes exactly where it stopped. Your deployment owns the schema, rows, and full run history.',
  modelLabel: 'Database engine',
  modelName: 'Amazon Aurora',
};

export const workflowNotes = [
  {
    icon: CodeFork,
    title: 'Chain templates',
    text: 'Each route defines step order, default models, dependencies, and the public run contract in the template layer.',
  },
  {
    icon: Fingerprint,
    title: 'Request contracts',
    text: 'Create-run requests are validated before execution so inputs, callbacks, and model overrides stay predictable.',
  },
  {
    icon: ChartLine,
    title: 'Persistent runs',
    text: 'Runs, ordered steps, outputs, provider metadata, callbacks, and replay checks stay in server-side storage.',
  },
  {
    icon: Microchip,
    title: 'Autopilot planning',
    text: 'Autopilot-mode can propose each next step from the previous output, chain context, and model schema.',
  },
  {
    icon: Flag,
    title: 'Copilot approvals',
    text: 'Copilot-mode checkpoints persist server-side, so you lock and approve each planned step or resume an awaiting run later.',
  },
  {
    icon: ShieldHalved,
    title: 'Credential isolation',
    text: 'Caller apps authenticate at your API boundary while provider BYOK credentials remain inside your backend.',
  },
  {
    icon: Share,
    title: 'Output handoff',
    text: 'A successful generation output becomes the next model input without extra orchestration from the caller.',
  },
  {
    icon: Database,
    title: 'File storage',
    text: 'Completed image and video outputs can be copied to your own storage, while provider URLs keep working when storage is off.',
  },
  {
    icon: Terminal,
    title: 'API control plane',
    text: 'Your deployment owns the orchestration API, queues, callbacks, and route contracts for products and tools.',
  },
];

export const homepageCta = {
  eyebrow: 'Launch your media workflow stack',
  title: 'Design on the canvas. Ship the API.',
  description:
    'Fork the starter, connect your provider keys, and compose flows on the canvas, or hand the next step to an agentic planner. Every run persists in durable database and ships through stable image and video routes for products, automations, and internal tools.',
  actions: [
    {
      href: 'https://github.com/babysea-community/babychain',
      icon: InlineGitHub,
      label: 'Fork starter',
      variant: 'outline' as const,
    },
  ],
};

export const communityPrograms = {
  eyebrow: 'Ecosystem programs',
  title: 'We are part of the AI community.',
  founderLabel: 'BabySea and its founder',
  founderHref: 'https://babysea.ai/about',
  description:
    'BabySea and its founder, the builder of BabyChain, are active across the AI community; joining accelerators and creator cohorts, sharing early feedback with model and tooling teams, and helping shape how image and video generation reaches real creative workflows.',
  programs: [
    { org: 'OpenAI', name: 'OpenAI for Startups' },
    { org: 'Alibaba Cloud', name: 'Alibaba AI Catalyst Program' },
    { org: 'Black Forest Labs', name: 'FLUX Creators' },
    { org: 'Runway', name: 'Runway Builders' },
  ],
};

export const communitySponsors = {
  eyebrow: 'Sponsors',
  title: 'Proudly supported by our sponsors.',
  description:
    'Thank you to every sponsor who helps keep this project running.',
  sponsors: [
    {
      icon: InlineSentry,
      name: 'Sentry',
    },
  ],
};

export const siteFooter = {
  brand: 'BabyChain',
  description:
    'Canvas studio, agentic planner, and durable chain API for image and video model workflows with one final callback.',
  githubPipeline: {
    eyebrow: 'Repository CI/CD',
    href: 'https://github.com/babysea-community/babychain/actions',
    label: 'GitHub CI',
    text: 'Build, test, and deploy checks for the public repository.',
  },
  pipeline: {
    eyebrow: 'CI/CD pipeline',
    href: 'https://gitlab.com/babysea/babychain/-/commits/main',
    label: 'GitLab CI mirror',
    text: 'Security, quality, and release checks for public review.',
  },
  linkGroups: [
    {
      title: 'Project',
      links: [
        {
          href: 'https://github.com/babysea-community/babychain',
          label: 'GitHub repository',
        },
        {
          href: 'https://github.com/babysea-community/babychain/blob/main/README.md',
          label: 'README',
        },
        {
          href: 'https://github.com/babysea-community/babychain/blob/main/CHANGELOG.md',
          label: 'Changelog',
        },
        {
          href: 'https://github.com/babysea-community/babychain/blob/main/SUPPORTED_MODELS.md',
          label: 'Supported models',
        },
      ],
    },
    {
      title: 'Community',
      links: [
        {
          href: 'https://github.com/babysea-community/babychain/blob/main/CONTRIBUTING.md',
          label: 'Contributing',
        },
        {
          href: 'https://github.com/babysea-community/babychain/blob/main/CODE_OF_CONDUCT.md',
          label: 'Code of conduct',
        },
        {
          href: 'https://github.com/babysea-community/babychain/issues',
          label: 'Issues',
        },
        {
          href: 'https://github.com/babysea-community/babychain/pulls',
          label: 'Pull requests',
        },
      ],
    },
    {
      title: 'Trust',
      links: [
        {
          href: 'https://github.com/babysea-community/babychain/blob/main/SECURITY.md',
          label: 'Security policy',
        },
        {
          href: 'https://github.com/babysea-community/babychain/blob/main/LICENSE',
          label: 'Apache-2.0 license',
        },
        {
          href: 'https://github.com/babysea-community/babychain/blob/main/LICENSES.md',
          label: 'License inventory',
        },
      ],
    },
  ],
};

export const chainDetailContent = {
  backLabel: 'Chain index',
  schemaTableTitle: 'input schema',
  schemaColumns: {
    field: 'Field',
    type: 'Type',
  },
  stepsEyebrow: 'execution flow',
  stepsTitle: 'The same route starts every ordered model step.',
  stepLabels: {
    dependencyPrefix: 'Depends on',
    indexPrefix: 'Step',
    rootDependency: 'run input',
  },
};

export function createHomepageMetrics({
  catalog,
  models,
}: {
  catalog: ModelChainCatalogEntry[];
  models: ModelCatalogEntry[];
}) {
  return [
    {
      label: 'available models',
      value: countUnique(models.map((model) => model.modelIdentifier)),
    },
    {
      label: 'chain templates',
      value: catalog
        .filter((entry) => entry.slug !== entry.templateSlug)
        .length.toLocaleString('en-US'),
    },
  ];
}

function countUnique(values: string[]) {
  return new Set(values).size.toLocaleString('en-US');
}
